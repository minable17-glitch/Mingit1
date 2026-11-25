-- 새싹책방: "더 읽기(보너스)" 하루 40분 제한 없애기 + 한국 날짜로 오늘 기록 찾기
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하고 기존 데이터는 그대로임.
-- 바뀌는 점
--  1) 하루 40분 상한을 없앰: 더 읽은 만큼 우리 반 나무 기여·악세서리가 모두 쌓임
--     (한 번에 너무 큰 값이 들어오는 것만 막음: 한 번에 최대 600분)
--  2) "오늘"을 한국 시간으로 계산(예전엔 서버 시간(UTC)이라 아침 9시 전에는 "오늘 기록이 없어요"가 떴음)
--  3) 악세서리는 그날 더 읽은 시간 합계로 10분마다 1개(15분+15분이면 3개). 실제로 받은 개수를 돌려줌

drop function if exists add_bonus_reading(int);
create function add_bonus_reading(p_extra_minutes int)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_log logs%rowtype;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_minutes int := least(greatest(0, coalesce(p_extra_minutes, 0)), 600);
  v_n int;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요';
  end if;

  select * into v_log from logs where logs.student_id = v_student.id and logs.log_date = v_today;
  if not found then
    raise exception '오늘 기록이 아직 없어요. 먼저 오늘의 읽기를 완료해주세요';
  end if;
  if v_minutes <= 0 then
    return 0;
  end if;

  update logs set minutes = minutes + v_minutes, overflow_minutes = overflow_minutes + v_minutes
    where logs.id = v_log.id;
  update students set communal_minutes = communal_minutes + v_minutes where students.id = v_student.id;

  v_n := floor((coalesce(v_log.overflow_minutes, 0) + v_minutes) / 10.0)::int - floor(coalesce(v_log.overflow_minutes, 0) / 10.0)::int;
  perform grant_accessories(v_student.id, v_n);
  return v_n;
end;
$$;
revoke all on function add_bonus_reading(int) from public;
grant execute on function add_bonus_reading(int) to anon, authenticated;
