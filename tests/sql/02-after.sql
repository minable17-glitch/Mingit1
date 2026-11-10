\set ON_ERROR_STOP 1
select '적용 후 | 가 일수=' || (select total_days from students where nickname='가') || ' 나=' || (select total_days from students where nickname='나') || ' (바뀌면 안 됨: 4, 1)';
select '적용 후 | 기존 기록 중 물 안 준 것=' || count(*) || ' (0이어야 함)' from logs where watered_at is null;
select '적용 후 | 반 참여율(전체 학생 평균)=' || class_pct || ' → (4+1+0)/3/30 = 6%' from get_class_progress('00000000-0000-0000-0000-0000000000c1');
-- 예전 앱이 기록 저장(watered_at 을 안 보냄) → 저장과 동시에 물 준 것으로
insert into logs (student_id, log_date, minutes, note) values ('00000000-0000-0000-0000-000000000002', current_date, 10, '예전 앱에서 저장한 기록');
select '예전 앱 저장 | 나 일수=' || total_days || ' (2여야 함)' from students where nickname='나';
-- 새 앱이 기록 저장(watered_at 을 비워서 보냄) → 나무 일수는 그대로, 초과 읽기 기여는 바로 반영
insert into logs (student_id, log_date, minutes, note, overflow_minutes, pages, watered_at) values ('00000000-0000-0000-0000-000000000001', current_date, 25, '새 앱에서 저장한 기록', 15, 12, null);
select '새 앱 저장 | 가 일수=' || total_days || ' (4 그대로) 공동기여=' || communal_minutes || '분 쪽수=' || total_pages from students where nickname='가';
-- 며칠 전 날짜로 안 준 물 하나 더(나중에 몰아서 주기 시험용) — 실제로는 그날 저장하고 안 준 경우
insert into logs (student_id, log_date, minutes, note, watered_at) values ('00000000-0000-0000-0000-000000000001', current_date - 6, 10, '며칠 전에 읽고 물을 안 준 기록', null);
-- 물 주기: 가 학생으로 로그인한 상태
set test.uid = '00000000-0000-0000-0000-0000000000e1';
select '물 1번 주기 | 준 횟수=' || water_tree((select id from logs where student_id='00000000-0000-0000-0000-000000000001' and log_date = current_date)) || ' → 가 일수=' || (select total_days from students where nickname='가') || ' (5)';
select '같은 기록에 또 주기 | 준 횟수=' || water_tree((select id from logs where student_id='00000000-0000-0000-0000-000000000001' and log_date = current_date)) || ' (0이어야 함) 가 일수=' || (select total_days from students where nickname='가');
-- 남의 기록에 물 주기 시도
select '남의 기록에 주기 | 준 횟수=' || water_tree((select id from logs where student_id='00000000-0000-0000-0000-000000000002' and log_date = current_date)) || ' (0이어야 함) 나 일수=' || (select total_days from students where nickname='나');
select '남은 물 모두 주기 | 준 횟수=' || water_tree() || ' → 가 일수=' || (select total_days from students where nickname='가') || ' (6)';
select '읽은 날 수(개근용) | ' || string_agg((select nickname from students s where s.id = r.student_id) || '=' || r.days, ' ' order by r.days desc) from get_class_read_days('00000000-0000-0000-0000-0000000000c1') r;
-- 선생님이 기록 삭제: 물 준 기록 → 일수 -1 / 안 준 기록 → 일수 그대로
set test.uid = '00000000-0000-0000-0000-0000000000e3';
insert into logs (student_id, log_date, minutes, note, watered_at) values ('00000000-0000-0000-0000-000000000003', current_date, 10, '다 학생의 안 준 기록입니다', null);
set test.uid = '00000000-0000-0000-0000-0000000000f1';
select teacher_delete_log((select id from logs where student_id='00000000-0000-0000-0000-000000000003'));
select teacher_delete_log((select id from logs where student_id='00000000-0000-0000-0000-000000000001' and log_date = current_date - 6));
select '삭제 후 | 다 일수=' || (select total_days from students where nickname='다') || ' (0 그대로) 가 일수=' || (select total_days from students where nickname='가') || ' (물 준 기록 삭제라 5)';
-- 새 챌린지: 어제 날짜의 안 준 물은 자동 처리되고 앨범에 담김. 오늘 기록 중 안 준 물은 새 챌린지에서 줄 수 있음
insert into logs (student_id, log_date, minutes, note, watered_at) values ('00000000-0000-0000-0000-000000000003', current_date - 1, 10, '다 학생이 어제 읽고 안 준 물', null);
insert into logs (student_id, log_date, minutes, note, watered_at) values ('00000000-0000-0000-0000-000000000003', current_date, 10, '다 학생이 오늘 읽고 안 준 물', null);
select '새 챌린지 시작 | 시작일=' || start_date from start_new_challenge('00000000-0000-0000-0000-0000000000c1');
select '새 챌린지 후 | 가 일수=' || (select total_days from students where nickname='가') || ' (오늘 물 준 기록 1) 나=' || (select total_days from students where nickname='나') || ' (1) 다=' || (select total_days from students where nickname='다') || ' (오늘 기록은 아직 안 줘서 0)';
select '새 챌린지 후 | 지난 기간에 안 준 물=' || count(*) || ' (0이어야 함)' from logs where watered_at is null and log_date < current_date;
select '앨범 | ' || string_agg((st->>'nickname') || ' ' || (st->>'days') || '일', ', ') from forest_albums a, jsonb_array_elements(a.snapshot->'students') st;
set test.uid = '00000000-0000-0000-0000-0000000000e3';
select '새 챌린지에서 오늘 물 주기 | 준 횟수=' || water_tree() || ' → 다 일수=' || (select total_days from students where nickname='다') || ' (1)';
