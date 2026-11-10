-- ── 지난 숲 앨범 (새 챌린지를 시작하면 지금까지 키운 숲과 독후감을 앨범으로 보관) ──
-- Supabase SQL Editor에 이 파일 내용을 그대로 붙여넣고 한 번 실행하면 됩니다.
-- 새 표(forest_albums)를 만들고 함수를 추가/교체할 뿐이라, 기존 학생·기록 데이터는 지워지지 않아요.
-- 여러 번 실행해도 안전합니다.

create table if not exists forest_albums (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  round_no int not null, -- 몇 번째 숲인지 (1기, 2기 ...)
  period_start date, -- 이 숲을 키운 기간
  period_end date,
  next_start_date date not null, -- 이 앨범을 만들면서 새로 시작한 챌린지의 시작일 (다음 숲의 기준일)
  challenge_days int not null,
  -- 그 당시 숲 모습 + 학생별 기록·독후감 복사본. 학생이 나중에 삭제돼도 앨범에는 남음
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table forest_albums enable row level security;
-- 직접 조회/수정은 막고, 아래 함수들로만 읽고 씀
revoke insert, update, delete, select on forest_albums from anon, authenticated;

-- 새 챌린지 시작: 지금 숲을 앨범으로 저장 → 학생 나무를 새싹부터 다시 키우도록 초기화
-- (읽기 기록·독후감 원본은 logs 표에 그대로 남고, 앨범에는 복사본이 하나 더 저장됨)
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
    set total_days = (select count(*) from logs l where l.student_id = st.id and l.log_date >= v_today),
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

-- 지난 숲 앨범 보기: 선생님은 전체(모든 학생 독후감 포함),
-- 학생은 숲 모습 + 자기 독후감만 볼 수 있음 (친구 독후감은 지금처럼 비공개)
create or replace function get_forest_albums(p_class_id uuid)
returns table(id uuid, round_no int, period_start date, period_end date, next_start_date date,
  challenge_days int, snapshot jsonb, created_at timestamptz)
language plpgsql security definer stable set search_path = public as $$
declare
  v_teacher boolean;
  v_me uuid;
begin
  if not (p_class_id in (select my_class_ids())) then
    raise exception '이 학급의 앨범을 볼 수 없어요';
  end if;
  v_teacher := is_class_teacher(p_class_id);
  select s.id into v_me from students s where s.class_id = p_class_id and s.auth_user_id = auth.uid();

  return query
    select a.id, a.round_no, a.period_start, a.period_end, a.next_start_date, a.challenge_days,
      case when v_teacher then a.snapshot
        else jsonb_set(a.snapshot, '{students}', coalesce((
          select jsonb_agg(case when (x.st ->> 'student_id')::uuid = v_me then x.st else x.st - 'logs' end order by x.ord)
          from jsonb_array_elements(a.snapshot -> 'students') with ordinality as x(st, ord)
        ), '[]'::jsonb))
      end,
      a.created_at
    from forest_albums a
    where a.class_id = p_class_id
    order by a.round_no desc;
end;
$$;

grant execute on function get_forest_albums(uuid) to anon, authenticated;

-- 선생님이 기록 하나를 지울 때, 이미 앨범으로 넘어간 지난 챌린지 기록이면
-- 지금 나무의 누적 일수는 건드리지 않도록 수정 (지난 기록 삭제로 새 나무가 줄어들지 않게)
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
      set total_days = greatest(0, total_days - 1),
          communal_minutes = greatest(0, communal_minutes - coalesce(v_log.overflow_minutes, 0)),
          total_pages = greatest(0, total_pages - coalesce(v_log.pages, 0))
      where students.id = v_log.student_id;
  end if;
end;
$$;

grant execute on function teacher_delete_log(uuid) to anon, authenticated;
