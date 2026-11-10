\set ON_ERROR_STOP 1
\pset format unaligned
-- ── 준비: 선생님 1, 반 1(시작일 10일 전, 30일 챌린지), 학생 3명(가, 나, 다). 예전 규칙으로 기록 몇 개
insert into teachers (id, username, password_hash, auth_user_id) values ('00000000-0000-0000-0000-0000000000a1', 't', 'x', '00000000-0000-0000-0000-0000000000f1');
insert into classes (id, name, code, start_date, challenge_days, teacher_id) values ('00000000-0000-0000-0000-0000000000c1', '3-2', 'ABC123', current_date - 10, 30, '00000000-0000-0000-0000-0000000000a1');
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values
 ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', '가', 'x', '00000000-0000-0000-0000-0000000000e1'),
 ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', '나', 'x', '00000000-0000-0000-0000-0000000000e2'),
 ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1', '다', 'x', '00000000-0000-0000-0000-0000000000e3');
insert into logs (student_id, log_date, minutes, note) select '00000000-0000-0000-0000-000000000001', current_date - g, 10, '예전 기록입니다 열자 이상' from generate_series(1, 4) g;
insert into logs (student_id, log_date, minutes, note) values ('00000000-0000-0000-0000-000000000002', current_date - 2, 10, '예전 기록입니다 열자 이상');
select '적용 전 | 가 일수=' || (select total_days from students where nickname='가') || ' 나=' || (select total_days from students where nickname='나') || ' 다=' || (select total_days from students where nickname='다');
select '적용 전 | 반 참여율(기록 있는 학생만 평균)=' || class_pct from get_class_progress('00000000-0000-0000-0000-0000000000c1');
