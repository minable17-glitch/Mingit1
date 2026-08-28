-- 새싹책방 데이터베이스 스키마
-- Supabase SQL Editor에서 새 프로젝트에 그대로 실행하면 지금까지 만든 것과 동일한 구조가 됩니다.
-- (실제 프로젝트에는 이 파일 내용이 여러 번의 SQL Editor 실행으로 나뉘어 이미 적용되어 있습니다.)
--
-- 사전 준비: Supabase 대시보드 → Authentication → Sign In / Providers 에서
-- "Anonymous Sign-Ins"를 켜주세요 (학생 PIN 로그인에 필요).

create extension if not exists pgcrypto;

-- ── 테이블 ──────────────────────────────────────────────

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  admin_password_hash text not null,
  start_date date not null default current_date,
  goal_pct int not null default 80,
  teacher_auth_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  nickname text not null,
  pin_hash text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  unique (class_id, nickname)
);

create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  title text not null,
  author text,
  cover_url text,
  is_completed boolean not null default false,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  book_id uuid references books(id) on delete set null,
  log_date date not null default current_date,
  minutes int not null default 10,
  note text not null,
  ocr_excerpt text,
  created_at timestamptz not null default now(),
  unique (student_id, log_date)
);

create table if not exists cheers (
  id uuid primary key default gen_random_uuid(),
  from_student_id uuid not null references students(id) on delete cascade,
  to_student_id uuid not null references students(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

create table if not exists reading_sessions (
  student_id uuid primary key references students(id) on delete cascade,
  is_reading boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────

alter table classes enable row level security;
alter table students enable row level security;
alter table books enable row level security;
alter table logs enable row level security;
alter table cheers enable row level security;
alter table reading_sessions enable row level security;

drop policy if exists "classes_select_all" on classes;
create policy "classes_select_all" on classes for select using (true);
drop policy if exists "classes_update_teacher" on classes;
create policy "classes_update_teacher" on classes for update
  using (teacher_auth_user_id = auth.uid())
  with check (teacher_auth_user_id = auth.uid());
revoke insert, delete on classes from anon, authenticated;
revoke select (admin_password_hash) on classes from anon, authenticated;

drop policy if exists "students_select_all" on students;
create policy "students_select_all" on students for select using (true);
revoke insert, update, delete on students from anon, authenticated;
revoke select (pin_hash) on students from anon, authenticated;

drop policy if exists "books_select_all" on books;
create policy "books_select_all" on books for select using (true);
drop policy if exists "books_insert_own" on books;
create policy "books_insert_own" on books for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));
drop policy if exists "books_update_own" on books;
create policy "books_update_own" on books for update
  using (student_id in (select id from students where auth_user_id = auth.uid()));

drop policy if exists "logs_select_own_or_teacher" on logs;
create policy "logs_select_own_or_teacher" on logs for select using (
  student_id in (select id from students where auth_user_id = auth.uid())
  or exists (
    select 1 from students s join classes c on c.id = s.class_id
    where s.id = logs.student_id and c.teacher_auth_user_id = auth.uid()
  )
);
drop policy if exists "logs_insert_own" on logs;
create policy "logs_insert_own" on logs for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));

drop policy if exists "cheers_select_all" on cheers;
create policy "cheers_select_all" on cheers for select using (true);
drop policy if exists "cheers_insert_own" on cheers;
create policy "cheers_insert_own" on cheers for insert
  with check (from_student_id in (select id from students where auth_user_id = auth.uid()));

drop policy if exists "reading_sessions_select_all" on reading_sessions;
create policy "reading_sessions_select_all" on reading_sessions for select using (true);
drop policy if exists "reading_sessions_insert_own" on reading_sessions;
create policy "reading_sessions_insert_own" on reading_sessions for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));
drop policy if exists "reading_sessions_update_own" on reading_sessions;
create policy "reading_sessions_update_own" on reading_sessions for update
  using (student_id in (select id from students where auth_user_id = auth.uid()));

-- ── 로그인/가입 함수 (SECURITY DEFINER, 비밀번호·PIN 해시 비교) ──
-- search_path에 extensions를 포함해야 pgcrypto의 crypt()/gen_salt()를 찾을 수 있습니다.

create or replace function create_class(
  p_name text, p_admin_password text, p_start_date date, p_goal_pct int
) returns table(id uuid, name text, code text, start_date date, goal_pct int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code text;
  v_id uuid;
begin
  loop
    v_code := '숲' || lpad((floor(random()*10000))::int::text, 4, '0');
    exit when not exists (select 1 from classes where classes.code = v_code);
  end loop;

  insert into classes (name, code, admin_password_hash, start_date, goal_pct, teacher_auth_user_id)
  values (p_name, v_code, crypt(p_admin_password, gen_salt('bf')), p_start_date, p_goal_pct, auth.uid())
  returning classes.id into v_id;

  return query select classes.id, classes.name, classes.code, classes.start_date, classes.goal_pct
    from classes where classes.id = v_id;
end;
$$;

create or replace function teacher_login(
  p_class_code text, p_admin_password text
) returns table(id uuid, name text, code text, start_date date, goal_pct int)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
begin
  select * into v_class from classes where classes.code = p_class_code;
  if not found then
    raise exception '학급 코드를 찾을 수 없어요';
  end if;
  if v_class.admin_password_hash <> crypt(p_admin_password, v_class.admin_password_hash) then
    raise exception '비밀번호가 올바르지 않아요';
  end if;

  update classes set teacher_auth_user_id = auth.uid() where classes.id = v_class.id;

  return query select classes.id, classes.name, classes.code, classes.start_date, classes.goal_pct
    from classes where classes.id = v_class.id;
end;
$$;

create or replace function student_login(
  p_class_code text, p_nickname text, p_pin text
) returns table(id uuid, class_id uuid, nickname text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_student students%rowtype;
begin
  select * into v_class from classes where classes.code = p_class_code;
  if not found then
    raise exception '학급 코드를 찾을 수 없어요';
  end if;

  select * into v_student from students
    where students.class_id = v_class.id and students.nickname = p_nickname;

  if not found then
    insert into students (class_id, nickname, pin_hash, auth_user_id)
    values (v_class.id, p_nickname, crypt(p_pin, gen_salt('bf')), auth.uid())
    returning * into v_student;
  else
    if v_student.pin_hash <> crypt(p_pin, v_student.pin_hash) then
      raise exception 'PIN이 올바르지 않아요';
    end if;
    update students set auth_user_id = auth.uid() where students.id = v_student.id;
  end if;

  return query select v_student.id, v_student.class_id, v_student.nickname;
end;
$$;

grant execute on function create_class(text, text, date, int) to anon, authenticated;
grant execute on function teacher_login(text, text) to anon, authenticated;
grant execute on function student_login(text, text, text) to anon, authenticated;
