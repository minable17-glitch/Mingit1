-- 새싹책방 2.0: 선생님도 함께 읽기(반 관리에서 켜고 끔)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하고 기존 데이터는 그대로임.
-- 켜면 그 반에 "선생님" 독서 자리(학생 표의 한 줄, is_teacher = true)가 생겨서, 학생과 똑같이 읽기·소감·물주기·악세서리를 씀.
-- 선생님 기록은 반 참여율·우리 반 숲·랭킹 계산에서 빠짐(학생만 계산).

alter table students add column if not exists is_teacher boolean not null default false;
alter table classes add column if not exists teacher_reads boolean not null default false;

-- 켜기·끄기(그 반 선생님만). 끄면 선생님 자리와 로그인 연결만 풀고 기록은 남겨 둠(다시 켜면 이어짐)
create or replace function set_teacher_reads(p_class_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_class_teacher(p_class_id) then
    raise exception '이 반의 선생님만 바꿀 수 있어요';
  end if;
  update classes set teacher_reads = coalesce(p_on, false) where id = p_class_id;
  if not coalesce(p_on, false) then
    update students set auth_user_id = null where class_id = p_class_id and is_teacher;
  end if;
end;
$$;
revoke all on function set_teacher_reads(uuid, boolean) from public;
grant execute on function set_teacher_reads(uuid, boolean) to anon, authenticated;

-- 선생님이 이 반 화면을 열 때: 선생님 독서 자리를 찾거나 만들고, 지금 로그인과 연결
-- (학생용 함수들은 "지금 로그인한 사람의 학생 자리"를 찾으므로, 같은 선생님의 다른 반 자리 연결은 풀어 둠)
create or replace function teacher_reader_enter(p_class_id uuid)
returns table(id uuid, nickname text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_nick text;
begin
  if auth.uid() is null or not is_class_teacher(p_class_id) then
    raise exception '이 반의 선생님만 쓸 수 있어요';
  end if;
  if not coalesce((select c.teacher_reads from classes c where c.id = p_class_id), false) then
    raise exception '선생님 함께 읽기가 꺼져 있어요';
  end if;
  select s.id, s.nickname into v_id, v_nick from students s where s.class_id = p_class_id and s.is_teacher order by s.created_at limit 1;
  if v_id is null then
    v_nick := '선생님';
    if exists (select 1 from students s where s.class_id = p_class_id and s.nickname = v_nick) then v_nick := '담임 선생님'; end if;
    if exists (select 1 from students s where s.class_id = p_class_id and s.nickname = v_nick) then v_nick := '선생님 ' || substr(md5(random()::text), 1, 4); end if;
    -- 학생 로그인으로는 들어올 수 없게 아무도 모르는 PIN을 넣어 둠
    insert into students (class_id, nickname, pin_hash, is_teacher)
      values (p_class_id, v_nick, crypt(gen_random_uuid()::text, gen_salt('bf')), true)
      returning students.id into v_id;
  end if;
  update students s set auth_user_id = null where s.auth_user_id = auth.uid() and s.is_teacher and s.id <> v_id;
  update students s set auth_user_id = auth.uid() where s.id = v_id;
  return query select v_id, v_nick;
end;
$$;
revoke all on function teacher_reader_enter(uuid) from public;
grant execute on function teacher_reader_enter(uuid) to anon, authenticated;

-- 반 참여율·우리 반 숲: 선생님 자리는 빼고 학생만 계산(나머지는 garden_watering.sql 과 같음)
create or replace function get_class_progress(p_class_id uuid)
returns table(joined_today int, total_students int, class_pct numeric, communal_minutes int)
language sql security definer set search_path = public, extensions as $$
  select
    (select count(distinct l.student_id)::int from logs l
       join students s on s.id = l.student_id
       where s.class_id = p_class_id and not s.is_teacher and l.log_date = current_date),
    (select count(*)::int from students where class_id = p_class_id and not is_teacher),
    coalesce((
      select round(avg(least(coalesce(t.days, 0), c.challenge_days)) / max(c.challenge_days) * 100)
      from students s
      join classes c on c.id = s.class_id
      left join (
        select l.student_id, count(*) as days
        from logs l join students s2 on s2.id = l.student_id
        join classes cc on cc.id = s2.class_id
        where s2.class_id = p_class_id and l.log_date >= cc.start_date
        group by l.student_id
      ) t on t.student_id = s.id
      where s.class_id = p_class_id and not s.is_teacher
    ), 0),
    coalesce((select sum(communal_minutes)::int from students where class_id = p_class_id and not is_teacher), 0)
$$;
grant execute on function get_class_progress(uuid) to anon, authenticated;
