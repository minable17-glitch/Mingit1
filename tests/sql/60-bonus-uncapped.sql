-- 더 읽기 제한 없애기 점검: 00-local-stubs.sql → supabase/schema.sql → supabase/bonus_uncapped.sql(두 번) → 이 파일
insert into classes (id, code, name, admin_password_hash) values ('11111111-1111-1111-1111-111111111111', 'BU1', '1반', 'x');
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '민수', 'x', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into books (id, student_id, title) values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '책');
set test.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
do $$ begin perform add_bonus_reading(30); raise notice '❌ 오늘 기록 없이 더 읽기'; exception when others then raise notice '✅ 오늘 기록 없으면 막힘: %', sqlerrm; end $$;
-- 한국 날짜로 오늘 기록(10분)
insert into logs (student_id, book_id, log_date, minutes, overflow_minutes, note) values ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', (now() at time zone 'Asia/Seoul')::date, 10, 0, '재미있었어요');
select '첫 더 읽기 15분 → 악세서리 1' as t, add_bonus_reading(15);
select '두 번째 15분 → 합계 30분이라 2' as t, add_bonus_reading(15);
select '세 번째 30분(예전엔 40분 제한으로 0) → 3' as t, add_bonus_reading(30);
select '오늘 기록 70분 / 더 읽은 60분 (70, 60)' as t, minutes, overflow_minutes from logs;
select '공동 기여 60분 (60)' as t, communal_minutes from students;
select '악세서리 총 6개 (6)' as t, sum(value::int) from students, jsonb_each_text(accessory_counts);
select '0분 → 0개 (0)' as t, add_bonus_reading(0);
select '한 번에 5000분을 보내도 600분만 → 악세서리 60 (60)' as t, add_bonus_reading(5000);
select '600분까지만 더해짐 (660)' as t, overflow_minutes from logs;
set test.uid = '';
do $$ begin perform add_bonus_reading(30); raise notice '❌ 로그인 없이'; exception when others then raise notice '✅ 로그인 없으면 막힘: %', sqlerrm; end $$;
