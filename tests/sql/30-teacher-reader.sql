-- 선생님 함께 읽기 SQL 점검: 00-local-stubs.sql → supabase/schema.sql → supabase/garden_watering.sql → supabase/teacher_reader.sql(두 번) → 이 파일
-- 각 줄 끝 괄호 안이 기대값
insert into teachers (id, username, password_hash, auth_user_id) values ('99999999-9999-9999-9999-999999999999', 'tch', 'x', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into classes (id, code, name, admin_password_hash, teacher_id, start_date) values
  ('11111111-1111-1111-1111-111111111111', 'TR1', '1반', null, '99999999-9999-9999-9999-999999999999', current_date - 2),
  ('11111111-1111-1111-1111-111111111112', 'TR2', '2반', null, '99999999-9999-9999-9999-999999999999', current_date - 2);
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '민수', 'x', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '선생님', 'x', null);   -- 학생이 '선생님'이라는 이름을 이미 씀
insert into logs (student_id, log_date, minutes, note) values ('22222222-2222-2222-2222-222222222222', current_date, 10, '재미있게 읽었어요 열 글자');

set test.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
do $$ begin perform set_teacher_reads('11111111-1111-1111-1111-111111111111', true); raise notice '❌ 학생이 켬'; exception when others then raise notice '✅ 학생은 못 켬: %', sqlerrm; end $$;

set test.uid = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
do $$ begin perform teacher_reader_enter('11111111-1111-1111-1111-111111111111'); raise notice '❌ 꺼져 있는데 들어감'; exception when others then raise notice '✅ 꺼져 있으면 못 들어감: %', sqlerrm; end $$;
select set_teacher_reads('11111111-1111-1111-1111-111111111111', true);
select '선생님 자리 이름 (담임 선생님 — 선생님은 학생이 이미 씀)' as t, nickname from teacher_reader_enter('11111111-1111-1111-1111-111111111111');
select '한 번 더 들어가도 자리 하나 (1)' as t, count(*) from teacher_reader_enter('11111111-1111-1111-1111-111111111111') x, students s where s.is_teacher and s.class_id = '11111111-1111-1111-1111-111111111111';
-- 선생님이 학생처럼 기록을 남김(학생용 저장 경로: 로그인한 사람의 학생 자리)
insert into logs (student_id, log_date, minutes, note) select id, current_date, 10, '선생님도 읽었어요 열 글자' from students where auth_user_id = auth.uid();
select '참여율에서 선생님 빠짐: 오늘 1명/학생 2명 (1, 2)' as t, joined_today, total_students from get_class_progress('11111111-1111-1111-1111-111111111111');
select '선생님 나무는 자람 (1)' as t, total_days from students where is_teacher and class_id = '11111111-1111-1111-1111-111111111111';
-- 다른 반에 들어가면 1반 자리 연결은 풀림
select set_teacher_reads('11111111-1111-1111-1111-111111111112', true);
select '2반 선생님 자리 (선생님)' as t, nickname from teacher_reader_enter('11111111-1111-1111-1111-111111111112');
select '로그인과 연결된 선생님 자리는 하나 (1, 2반)' as t, count(*), min(c.name) from students s join classes c on c.id = s.class_id where s.auth_user_id = auth.uid();
-- 끄면 연결만 풀리고 기록은 남음
select set_teacher_reads('11111111-1111-1111-1111-111111111111', false);
select '끈 뒤 1반 선생님 기록 남음 (1)' as t, count(*) from logs l join students s on s.id = l.student_id where s.is_teacher and s.class_id = '11111111-1111-1111-1111-111111111111';
-- 학생은 선생님 자리로 로그인 못 함
set test.uid = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
do $$ begin perform student_login('TR1', '담임 선생님', '0000'); raise notice '❌ 학생이 선생님 자리로 로그인함'; exception when others then raise notice '✅ 선생님 자리로 학생 로그인 막힘: %', sqlerrm; end $$;
