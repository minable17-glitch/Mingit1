-- ============================================================
-- 새싹책방 2.0 · 정원 물주기 (나중에 줄 수 있는 물)
-- ============================================================
-- 이 파일은 Supabase SQL Editor에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.
-- 기존 데이터는 지워지지 않습니다. 지금 배포된 앱(예전 화면)도 실행 전과 똑같이 동작합니다.
--
-- 바뀌는 규칙
--   · 소감을 저장하면 "물 1번"이 생기고, 같은 챌린지 기간 안이면 언제든 정원에서 줄 수 있음
--   · 나무는 "물을 준 횟수"로 자람. 읽은 날 수(개근·참여율)는 물주기와 상관없이 그대로 인정
--   · 새 챌린지를 시작할 때 안 준 물은 자동으로 준 것으로 처리
--   · 반 참여율은 한 번도 안 읽은 학생까지 포함한 전체 학생 평균으로 계산
--
-- 예전 앱과 함께 쓸 수 있는 이유
--   · logs.watered_at 의 기본값이 "지금"이라, 예전 앱이 기록을 저장하면 저장과 동시에 물을 준 것으로 처리됨(지금과 같음)
--   · 새 앱(3D 정원)은 기록을 저장할 때 watered_at 을 비워서 보내고, 정원에서 water_tree() 로 물을 줌

-- ── 1) 물 준 시각 열. 처음 만들 때만 기존 기록을 "이미 물 줌"으로 채움(나무 단계가 하나도 바뀌지 않음)
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'logs' and column_name = 'watered_at') then
    alter table logs add column watered_at timestamptz;
    update logs set watered_at = created_at;
    alter table logs alter column watered_at set default now();
  end if;
end $$;

-- ── 2) 기록 저장 트리거: 물을 아직 안 준 기록(watered_at 이 비어 있음)은 나무 일수를 올리지 않음
--      공동 기여 시간·쪽수·악세서리 지급은 기록을 저장할 때 그대로 처리
create or replace function bump_student_days()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_overflow int := coalesce(new.overflow_minutes, 0);
begin
  update students
    set total_days = total_days + (case when new.watered_at is null then 0 else 1 end),
        communal_minutes = communal_minutes + v_overflow,
        total_pages = total_pages + coalesce(new.pages, 0)
    where students.id = new.student_id;

  perform grant_accessories(new.student_id, floor(v_overflow / 10.0)::int);
  return new;
end;
$$;

-- ── 3) 물 주기: 기록 하나(p_log_id) 또는 남은 물 전부(p_log_id 를 비움). 준 횟수를 돌려줌
--      본인 기록인지, 지금 챌린지 기간의 기록인지, 아직 안 준 물인지 서버에서 확인하고 한 번에 처리
create or replace function water_tree(p_log_id uuid default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_student students%rowtype;
  v_start date;
  v_n int;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요';
  end if;
  select c.start_date into v_start from classes c where c.id = v_student.class_id;

  with w as (
    update logs set watered_at = now()
      where logs.student_id = v_student.id and logs.watered_at is null and logs.log_date >= v_start
        and (p_log_id is null or logs.id = p_log_id)
      returning 1
  )
  select count(*) into v_n from w;

  if v_n > 0 then
    update students set total_days = total_days + v_n where students.id = v_student.id;
  end if;
  return v_n;
end;
$$;

grant execute on function water_tree(uuid) to anon, authenticated;

-- ── 4) 새 챌린지 시작: 안 준 물 자동 처리 + 새 나무 일수는 물 준 기록만
create or replace function start_new_challenge(p_class_id uuid)
returns table(id uuid, name text, code text, start_date date, goal_pct int,
  daily_target_minutes int, challenge_days int, paused_since date, paused_days_total int)
language plpgsql security definer set search_path = public as $$
declare
  v_class classes%rowtype;
  v_today date := current_date;
  v_prev_start date;
  v_from date;
  v_round int;
  v_progress record;
  v_students jsonb;
begin
  if not is_class_teacher(p_class_id) then
    raise exception '이 학급의 담당 선생님만 새 챌린지를 시작할 수 있어요';
  end if;

  select * into v_class from classes c where c.id = p_class_id for update;
  select max(a.next_start_date), coalesce(max(a.round_no), 0) into v_prev_start, v_round
    from forest_albums a where a.class_id = p_class_id;

  -- 첫 앨범이면 지금까지의 모든 기록이 나무에 반영돼 있었으므로 전부 담음
  v_from := coalesce(v_prev_start, '-infinity'::date);
  if v_today <= v_from then
    raise exception '오늘 이미 새 챌린지를 시작했어요. 내일 다시 시도해주세요.';
  end if;

  -- 지난 챌린지에서 아직 안 준 물은 자동으로 준 것으로 처리 (학생이 손해 보지 않게)
  update logs l set watered_at = now()
    from students s
    where s.id = l.student_id and s.class_id = p_class_id
      and l.watered_at is null and l.log_date < v_today;

  select * into v_progress from get_class_progress(p_class_id);

  -- 오늘 기록은 새 챌린지의 첫날로 넘어가므로, 앨범에는 어제까지의 기록만 담음
  select coalesce(jsonb_agg(jsonb_build_object(
      'student_id', s.id,
      'nickname', s.nickname,
      'days', (select count(*) from logs l
                 where l.student_id = s.id and l.log_date >= v_from and l.log_date < v_today),
      'minutes', (select coalesce(sum(l.minutes), 0) from logs l
                    where l.student_id = s.id and l.log_date >= v_from and l.log_date < v_today),
      'pages', (select coalesce(sum(l.pages), 0) from logs l
                  where l.student_id = s.id and l.log_date >= v_from and l.log_date < v_today),
      'communal_minutes', (select coalesce(sum(l.overflow_minutes), 0) from logs l
                             where l.student_id = s.id and l.log_date >= v_from and l.log_date < v_today),
      'accessories', s.equipped_accessories,
      'completed_books', (select coalesce(jsonb_agg(b.title order by b.completed_at), '[]'::jsonb) from books b
                            where b.student_id = s.id and b.is_completed
                              and b.completed_at::date >= v_from and b.completed_at::date < v_today),
      'logs', (select coalesce(jsonb_agg(jsonb_build_object(
                  'date', l.log_date, 'minutes', l.minutes, 'pages', l.pages,
                  'note', l.note, 'quote', l.ocr_excerpt, 'book', bk.title) order by l.log_date), '[]'::jsonb)
                from logs l left join books bk on bk.id = l.book_id
                where l.student_id = s.id and l.log_date >= v_from and l.log_date < v_today)
    ) order by s.nickname), '[]'::jsonb)
    into v_students
    from students s where s.class_id = p_class_id;

  insert into forest_albums (class_id, round_no, period_start, period_end, next_start_date, challenge_days, snapshot)
  values (
    p_class_id,
    v_round + 1,
    coalesce(v_prev_start, least(v_class.start_date,
      (select min(l.log_date) from logs l join students s on s.id = l.student_id where s.class_id = p_class_id))),
    v_today - 1,
    v_today,
    v_class.challenge_days,
    jsonb_build_object(
      'class_name', v_class.name,
      'goal_pct', v_class.goal_pct,
      'class_pct', coalesce(v_progress.class_pct, 0),
      'communal_minutes', coalesce(v_progress.communal_minutes, 0),
      'total_students', coalesce(v_progress.total_students, 0),
      'students', v_students
    )
  );

  -- 나무를 새싹부터 다시: 누적 일수·공동 기여·페이지를 "오늘 기록"만 남기고 다시 셈
  update students st
    set total_days = (select count(*) from logs l where l.student_id = st.id and l.log_date >= v_today and l.watered_at is not null),
        communal_minutes = (select coalesce(sum(l.overflow_minutes), 0) from logs l
                              where l.student_id = st.id and l.log_date >= v_today),
        total_pages = (select coalesce(sum(l.pages), 0) from logs l
                         where l.student_id = st.id and l.log_date >= v_today)
    where st.class_id = p_class_id;

  update classes set start_date = v_today, paused_since = null, paused_days_total = 0
    where classes.id = p_class_id;

  return query select classes.id, classes.name, classes.code, classes.start_date, classes.goal_pct,
    classes.daily_target_minutes, classes.challenge_days, classes.paused_since, classes.paused_days_total
    from classes where classes.id = p_class_id;
end;
$$;


grant execute on function start_new_challenge(uuid) to anon, authenticated;

-- ── 5) 선생님이 기록을 지울 때: 물을 준 기록일 때만 나무 일수를 줄임
create or replace function teacher_delete_log(p_log_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_log logs%rowtype;
  v_is_owner boolean;
  v_round_start date;
begin
  select * into v_log from logs where logs.id = p_log_id;
  if not found then
    raise exception '기록을 찾을 수 없어요';
  end if;

  select is_class_teacher(s.class_id) into v_is_owner from students s where s.id = v_log.student_id;
  if not v_is_owner then
    raise exception '이 학급의 담당 선생님만 기록을 삭제할 수 있어요';
  end if;

  select max(a.next_start_date) into v_round_start
    from forest_albums a join students s on s.class_id = a.class_id
    where s.id = v_log.student_id;

  delete from logs where logs.id = p_log_id;

  if v_log.log_date >= coalesce(v_round_start, '-infinity'::date) then
    update students
      set total_days = greatest(0, total_days - (case when v_log.watered_at is null then 0 else 1 end)),
          communal_minutes = greatest(0, communal_minutes - coalesce(v_log.overflow_minutes, 0)),
          total_pages = greatest(0, total_pages - coalesce(v_log.pages, 0))
      where students.id = v_log.student_id;
  end if;
end;
$$;

grant execute on function teacher_delete_log(uuid) to anon, authenticated;

-- ── 6) 반 참여율: 한 번도 안 읽은 학생도 0일로 넣어 전체 학생 평균으로 계산
drop function if exists get_class_progress(uuid);
create function get_class_progress(p_class_id uuid)
returns table(joined_today int, total_students int, class_pct numeric, communal_minutes int)
language sql security definer set search_path = public, extensions as $$
  select
    (select count(distinct l.student_id)::int from logs l
       join students s on s.id = l.student_id
       where s.class_id = p_class_id and l.log_date = current_date),
    (select count(*)::int from students where class_id = p_class_id),
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
      where s.class_id = p_class_id
    ), 0),
    coalesce((select sum(communal_minutes)::int from students where class_id = p_class_id), 0)
$$;

grant execute on function get_class_progress(uuid) to anon, authenticated;

-- ── 7) 읽은 날 수(개근 배지용): 물을 늦게 줘도 개근은 인정되도록, 학생별 "읽은 날 수"만 돌려줌(소감 내용은 노출 안 됨)
create or replace function get_class_read_days(p_class_id uuid)
returns table(student_id uuid, days int)
language plpgsql security definer stable set search_path = public as $$
begin
  if not (p_class_id in (select my_class_ids())) then
    raise exception '이 학급의 정보를 볼 수 없어요';
  end if;
  return query
    select s.id, count(l.id)::int
    from students s
    join classes c on c.id = s.class_id
    left join logs l on l.student_id = s.id and l.log_date >= c.start_date
    where s.class_id = p_class_id
    group by s.id;
end;
$$;

grant execute on function get_class_read_days(uuid) to anon, authenticated;
