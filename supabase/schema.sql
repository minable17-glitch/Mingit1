-- LEVEL-UP ARCHERY (양궁 성장일지) 데이터베이스 스키마
-- Supabase SQL Editor에서 새 프로젝트에 그대로 실행하면 됩니다.
--
-- 사전 준비: Supabase 대시보드 → Authentication → Sign In / Providers 에서
-- "Anonymous Sign-Ins"를 켜주세요 (학생 로그인 + 관리자 로그인 모두 내부적으로
-- 익명 인증 세션을 사용합니다. 로그인은 학번+이름+PIN, 관리자는 학급코드+관리자코드로
-- 하며, Supabase 이메일 인증은 전혀 쓰지 않습니다).
--
-- 설계: 이 앱은 RLS(Row Level Security)를 켜두되 직접 테이블 접근은 기본적으로 전부
-- 막아두고, 모든 읽기/쓰기를 SECURITY DEFINER 함수(RPC)를 통해서만 하도록 합니다.
-- 유일한 예외는 읽어보기/배워보기 콘텐츠 조회로, 민감하지 않은 데이터라 anon에게
-- 직접 select를 허용합니다 (관리자 쪽에서 숨김 처리한 것만 제외).

create extension if not exists pgcrypto;

-- ── 테이블 ──────────────────────────────────────────────

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  admin_pin_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  student_number text not null,
  name text not null,
  pin_hash text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  unique (class_id, student_number, name)
);

create table if not exists equipment (
  student_id uuid primary key references students(id) on delete cascade,
  bow_number text,
  lane_info text,
  sight_vertical text,
  sight_horizontal text,
  sight_note text,
  updated_at timestamptz not null default now()
);

create table if not exists read_contents (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  category text,
  image_urls text,
  order_index int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists learn_contents (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  title text not null,
  category text,
  video_url text,
  image_urls text,
  description text,
  order_index int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shooting_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  class_name text,
  student_name text,
  student_number text,
  log_date date not null,
  session_label text,
  bow_number text,
  markers jsonb not null default '[]'::jsonb,
  hit_count int not null default 0,
  group_center_x numeric,
  group_center_y numeric,
  aim_advice text,
  sight_before text,
  sight_after text,
  created_at timestamptz not null default now(),
  unique (student_id, log_date)
);

create table if not exists reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  class_name text,
  student_name text,
  student_number text,
  log_date date not null,
  used_skills text[] not null default '{}',
  short_note text,
  endure text,
  regulate text,
  life_link text,
  created_at timestamptz not null default now(),
  unique (student_id, log_date)
);

create index if not exists idx_students_class on students(class_id);
create index if not exists idx_read_contents_class on read_contents(class_id, order_index);
create index if not exists idx_learn_contents_class on learn_contents(class_id, order_index);
create index if not exists idx_shooting_logs_class on shooting_logs(class_id, log_date desc);
create index if not exists idx_reflections_class on reflections(class_id, log_date desc);

-- ── RLS: 기본적으로 전부 잠그고, 콘텐츠 조회만 anon에게 허용 ──────────

alter table classes enable row level security;
alter table students enable row level security;
alter table equipment enable row level security;
alter table read_contents enable row level security;
alter table learn_contents enable row level security;
alter table shooting_logs enable row level security;
alter table reflections enable row level security;

drop policy if exists read_contents_select_visible on read_contents;
create policy read_contents_select_visible on read_contents for select using (visible = true);
grant select on read_contents to anon, authenticated;

drop policy if exists learn_contents_select_visible on learn_contents;
create policy learn_contents_select_visible on learn_contents for select using (visible = true);
grant select on learn_contents to anon, authenticated;

-- ── 관리자 코드 검증 헬퍼 (다른 관리자 함수들이 내부에서 재사용) ──────

create or replace function assert_admin(p_class_id uuid, p_admin_pin text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
begin
  select * into v_class from classes where classes.id = p_class_id;
  if not found then
    raise exception '학급을 찾을 수 없어요';
  end if;
  if v_class.admin_pin_hash <> crypt(coalesce(p_admin_pin, ''), v_class.admin_pin_hash) then
    raise exception '관리자 코드가 올바르지 않아요';
  end if;
end;
$$;

-- ── 로그인 ──────────────────────────────────────────────

create or replace function create_class(p_name text, p_admin_pin text)
returns table(id uuid, name text, code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_row classes%rowtype;
begin
  if p_admin_pin !~ '^[0-9]{4,}$' then
    raise exception '관리자 코드는 숫자 4자리 이상으로 입력해주세요';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception '학급 이름을 입력해주세요';
  end if;
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from classes c where c.code = v_code);
  end loop;
  insert into classes (name, code, admin_pin_hash)
  values (trim(p_name), v_code, crypt(p_admin_pin, gen_salt('bf')))
  returning * into v_row;
  return query select v_row.id, v_row.name, v_row.code;
end;
$$;
grant execute on function create_class(text, text) to anon, authenticated;

create or replace function teacher_login(p_class_code text, p_admin_pin text)
returns table(id uuid, name text, code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
begin
  select * into v_class from classes where classes.code = upper(trim(p_class_code));
  if not found then
    raise exception '학급 코드를 찾을 수 없어요';
  end if;
  if v_class.admin_pin_hash <> crypt(coalesce(p_admin_pin, ''), v_class.admin_pin_hash) then
    raise exception '관리자 코드가 올바르지 않아요';
  end if;
  return query select v_class.id, v_class.name, v_class.code;
end;
$$;
grant execute on function teacher_login(text, text) to anon, authenticated;

create or replace function student_login(p_class_code text, p_student_number text, p_name text, p_pin text)
returns table(id uuid, class_id uuid, student_number text, name text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_student students%rowtype;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN은 숫자 4자리로 입력해주세요';
  end if;
  select * into v_class from classes where classes.code = upper(trim(p_class_code));
  if not found then
    raise exception '학급 코드를 찾을 수 없어요';
  end if;

  select * into v_student from students
    where students.class_id = v_class.id
      and students.student_number = trim(p_student_number)
      and students.name = trim(p_name);

  if not found then
    insert into students (class_id, student_number, name, pin_hash, auth_user_id)
    values (v_class.id, trim(p_student_number), trim(p_name), crypt(p_pin, gen_salt('bf')), auth.uid())
    returning * into v_student;
  else
    if v_student.pin_hash <> crypt(p_pin, v_student.pin_hash) then
      raise exception 'PIN이 올바르지 않아요';
    end if;
    update students set auth_user_id = auth.uid() where students.id = v_student.id;
  end if;

  return query select v_student.id, v_student.class_id, v_student.student_number, v_student.name;
end;
$$;
grant execute on function student_login(text, text, text, text) to anon, authenticated;

-- ── 내 장비 ──────────────────────────────────────────────

create or replace function save_equipment(
  p_bow_number text, p_lane_info text,
  p_sight_vertical text, p_sight_horizontal text, p_sight_note text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student_id uuid;
begin
  select id into v_student_id from students where auth_user_id = auth.uid();
  if v_student_id is null then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  insert into equipment (student_id, bow_number, lane_info, sight_vertical, sight_horizontal, sight_note, updated_at)
  values (v_student_id, p_bow_number, p_lane_info, p_sight_vertical, p_sight_horizontal, p_sight_note, now())
  on conflict (student_id) do update set
    bow_number = excluded.bow_number,
    lane_info = excluded.lane_info,
    sight_vertical = excluded.sight_vertical,
    sight_horizontal = excluded.sight_horizontal,
    sight_note = excluded.sight_note,
    updated_at = now();
end;
$$;
grant execute on function save_equipment(text, text, text, text, text) to anon, authenticated;

create or replace function get_my_equipment()
returns table(bow_number text, lane_info text, sight_vertical text, sight_horizontal text, sight_note text, updated_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select e.bow_number, e.lane_info, e.sight_vertical, e.sight_horizontal, e.sight_note, e.updated_at
    from equipment e
    join students s on s.id = e.student_id
    where s.auth_user_id = auth.uid();
end;
$$;
grant execute on function get_my_equipment() to anon, authenticated;

-- ── 기록하기 (탄착·조준 보정) ──────────────────────────────

create or replace function save_shooting_log(
  p_log_date date, p_session_label text, p_bow_number text,
  p_markers jsonb, p_hit_count int,
  p_group_center_x numeric, p_group_center_y numeric,
  p_aim_advice text, p_sight_before text, p_sight_after text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_class classes%rowtype;
begin
  select * into v_student from students where auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  select * into v_class from classes where id = v_student.class_id;

  insert into shooting_logs (
    student_id, class_id, class_name, student_name, student_number,
    log_date, session_label, bow_number, markers, hit_count,
    group_center_x, group_center_y, aim_advice, sight_before, sight_after
  ) values (
    v_student.id, v_student.class_id, v_class.name, v_student.name, v_student.student_number,
    p_log_date, p_session_label, p_bow_number, coalesce(p_markers, '[]'::jsonb), coalesce(p_hit_count, 0),
    p_group_center_x, p_group_center_y, p_aim_advice, p_sight_before, p_sight_after
  )
  on conflict (student_id, log_date) do update set
    session_label = excluded.session_label,
    bow_number = excluded.bow_number,
    markers = excluded.markers,
    hit_count = excluded.hit_count,
    group_center_x = excluded.group_center_x,
    group_center_y = excluded.group_center_y,
    aim_advice = excluded.aim_advice,
    sight_before = excluded.sight_before,
    sight_after = excluded.sight_after;
end;
$$;
grant execute on function save_shooting_log(date, text, text, jsonb, int, numeric, numeric, text, text, text) to anon, authenticated;

create or replace function get_my_shooting_log(p_log_date date)
returns table(
  log_date date, session_label text, bow_number text, markers jsonb, hit_count int,
  group_center_x numeric, group_center_y numeric, aim_advice text, sight_before text, sight_after text
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select l.log_date, l.session_label, l.bow_number, l.markers, l.hit_count,
           l.group_center_x, l.group_center_y, l.aim_advice, l.sight_before, l.sight_after
    from shooting_logs l
    join students s on s.id = l.student_id
    where s.auth_user_id = auth.uid() and l.log_date = p_log_date;
end;
$$;
grant execute on function get_my_shooting_log(date) to anon, authenticated;

create or replace function get_my_shooting_history(p_limit int default 10)
returns table(log_date date, hit_count int, session_label text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select l.log_date, l.hit_count, l.session_label
    from shooting_logs l
    join students s on s.id = l.student_id
    where s.auth_user_id = auth.uid()
    order by l.log_date desc
    limit p_limit;
end;
$$;
grant execute on function get_my_shooting_history(int) to anon, authenticated;

-- ── 성찰하기 ──────────────────────────────────────────────

create or replace function save_reflection(
  p_log_date date, p_used_skills text[], p_short_note text,
  p_endure text, p_regulate text, p_life_link text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_class classes%rowtype;
begin
  select * into v_student from students where auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요. 다시 로그인해주세요';
  end if;
  select * into v_class from classes where id = v_student.class_id;

  insert into reflections (
    student_id, class_id, class_name, student_name, student_number,
    log_date, used_skills, short_note, endure, regulate, life_link
  ) values (
    v_student.id, v_student.class_id, v_class.name, v_student.name, v_student.student_number,
    p_log_date, coalesce(p_used_skills, '{}'), p_short_note, p_endure, p_regulate, p_life_link
  )
  on conflict (student_id, log_date) do update set
    used_skills = excluded.used_skills,
    short_note = excluded.short_note,
    endure = excluded.endure,
    regulate = excluded.regulate,
    life_link = excluded.life_link;
end;
$$;
grant execute on function save_reflection(date, text[], text, text, text, text) to anon, authenticated;

create or replace function get_my_reflection(p_log_date date)
returns table(log_date date, used_skills text[], short_note text, endure text, regulate text, life_link text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    select r.log_date, r.used_skills, r.short_note, r.endure, r.regulate, r.life_link
    from reflections r
    join students s on s.id = r.student_id
    where s.auth_user_id = auth.uid() and r.log_date = p_log_date;
end;
$$;
grant execute on function get_my_reflection(date) to anon, authenticated;

-- ── 관리자: 콘텐츠 관리 ──────────────────────────────────

create or replace function admin_list_read_contents(p_class_id uuid, p_admin_pin text)
returns setof read_contents
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  return query select * from read_contents where class_id = p_class_id order by order_index, created_at;
end;
$$;
grant execute on function admin_list_read_contents(uuid, text) to anon, authenticated;

create or replace function admin_upsert_read_content(
  p_class_id uuid, p_admin_pin text, p_id uuid,
  p_title text, p_category text, p_image_urls text, p_order_index int, p_visible boolean
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  perform assert_admin(p_class_id, p_admin_pin);
  if p_id is null then
    insert into read_contents (class_id, title, category, image_urls, order_index, visible)
    values (p_class_id, p_title, p_category, p_image_urls, coalesce(p_order_index, 0), coalesce(p_visible, true))
    returning id into v_id;
  else
    update read_contents set
      title = p_title, category = p_category, image_urls = p_image_urls,
      order_index = coalesce(p_order_index, 0), visible = coalesce(p_visible, true)
    where id = p_id and class_id = p_class_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function admin_upsert_read_content(uuid, text, uuid, text, text, text, int, boolean) to anon, authenticated;

create or replace function admin_delete_read_content(p_class_id uuid, p_admin_pin text, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  delete from read_contents where id = p_id and class_id = p_class_id;
end;
$$;
grant execute on function admin_delete_read_content(uuid, text, uuid) to anon, authenticated;

create or replace function admin_list_learn_contents(p_class_id uuid, p_admin_pin text)
returns setof learn_contents
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  return query select * from learn_contents where class_id = p_class_id order by order_index, created_at;
end;
$$;
grant execute on function admin_list_learn_contents(uuid, text) to anon, authenticated;

create or replace function admin_upsert_learn_content(
  p_class_id uuid, p_admin_pin text, p_id uuid,
  p_title text, p_category text, p_video_url text, p_image_urls text, p_description text,
  p_order_index int, p_visible boolean
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
begin
  perform assert_admin(p_class_id, p_admin_pin);
  if p_id is null then
    insert into learn_contents (class_id, title, category, video_url, image_urls, description, order_index, visible)
    values (p_class_id, p_title, p_category, p_video_url, p_image_urls, p_description, coalesce(p_order_index, 0), coalesce(p_visible, true))
    returning id into v_id;
  else
    update learn_contents set
      title = p_title, category = p_category, video_url = p_video_url,
      image_urls = p_image_urls, description = p_description,
      order_index = coalesce(p_order_index, 0), visible = coalesce(p_visible, true)
    where id = p_id and class_id = p_class_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
grant execute on function admin_upsert_learn_content(uuid, text, uuid, text, text, text, text, text, int, boolean) to anon, authenticated;

create or replace function admin_delete_learn_content(p_class_id uuid, p_admin_pin text, p_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  delete from learn_contents where id = p_id and class_id = p_class_id;
end;
$$;
grant execute on function admin_delete_learn_content(uuid, text, uuid) to anon, authenticated;

-- ── 관리자: 학생·기록 조회 ──────────────────────────────

create or replace function admin_list_students(p_class_id uuid, p_admin_pin text)
returns table(
  student_id uuid, student_number text, name text, created_at timestamptz,
  has_equipment boolean, shooting_log_count bigint, reflection_count bigint
)
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  return query
    select s.id, s.student_number, s.name, s.created_at,
      exists(select 1 from equipment e where e.student_id = s.id),
      (select count(*) from shooting_logs l where l.student_id = s.id),
      (select count(*) from reflections r where r.student_id = s.id)
    from students s
    where s.class_id = p_class_id
    order by s.student_number;
end;
$$;
grant execute on function admin_list_students(uuid, text) to anon, authenticated;

create or replace function admin_list_shooting_logs(p_class_id uuid, p_admin_pin text, p_limit int default 300)
returns setof shooting_logs
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  return query select * from shooting_logs where class_id = p_class_id order by log_date desc, created_at desc limit p_limit;
end;
$$;
grant execute on function admin_list_shooting_logs(uuid, text, int) to anon, authenticated;

create or replace function admin_list_reflections(p_class_id uuid, p_admin_pin text, p_limit int default 300)
returns setof reflections
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform assert_admin(p_class_id, p_admin_pin);
  return query select * from reflections where class_id = p_class_id order by log_date desc, created_at desc limit p_limit;
end;
$$;
grant execute on function admin_list_reflections(uuid, text, int) to anon, authenticated;
