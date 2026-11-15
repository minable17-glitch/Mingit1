-- 화단 꾸미기 SQL 점검: 00-local-stubs.sql → supabase/schema.sql → supabase/garden_watering.sql → supabase/garden_decor.sql(두 번) → 이 파일
-- 각 줄 끝 괄호 안이 기대값
insert into classes (id, code, name, admin_password_hash, start_date) values ('11111111-1111-1111-1111-111111111111', 'GD1', '1반', 'x', current_date - 5);
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '민수', 'x', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '지우', 'x', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select '처음 선물: 이름 팻말 1개 (1)' as t, decor_counts ->> 'prop_name_sign' from students where nickname = '민수';
create function total_decor(uuid) returns int language sql as $$ select coalesce(sum(value::int), 0)::int from students s, jsonb_each_text(s.decor_counts) where s.id = $1 $$;
-- 자유 읽기: 목표 넘겨 45분 → 2개(20분마다)
insert into logs (id, student_id, log_date, minutes, overflow_minutes, note) values ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', current_date - 1, 55, 45, '재미있게 읽었어요 열 글자');
select '45분 더 읽음 → 1 + 2 = (3)' as t, total_decor('22222222-2222-2222-2222-222222222222');
update logs set overflow_minutes = 61 where id = '44444444-4444-4444-4444-444444444444';
select '보너스로 61분까지 → 40·60분을 넘겨 +1 = (4)' as t, total_decor('22222222-2222-2222-2222-222222222222');
-- 완독: 기록 있는 책만, 한 번만
insert into books (id, student_id, title) values ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '읽은 책'), ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '안 읽은 책');
update logs set book_id = '55555555-5555-5555-5555-555555555555' where id = '44444444-4444-4444-4444-444444444444';
update books set is_completed = true where id = '66666666-6666-6666-6666-666666666666';
select '기록 없는 책 완독 → 그대로 (4)' as t, total_decor('22222222-2222-2222-2222-222222222222');
update books set is_completed = true where id = '55555555-5555-5555-5555-555555555555';
select '기록 있는 책 완독 → (5)' as t, total_decor('22222222-2222-2222-2222-222222222222');
update books set is_completed = false, decor_granted = false where id = '55555555-5555-5555-5555-555555555555';
update books set is_completed = true where id = '55555555-5555-5555-5555-555555555555';
select '완독 껐다(받은 표시도 지우려 해도) 다시 켜도 그대로 (5)' as t, total_decor('22222222-2222-2222-2222-222222222222');
-- 놓기
set test.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select student_set_decor(array['prop_name_sign', null, null]);
select '팻말을 첫 자리에 (["prop_name_sign", null, null])' as t, decor_placed from students where nickname = '민수';
do $$ begin perform student_set_decor(array['prop_name_sign', 'prop_name_sign']); raise notice '❌ 1개뿐인데 2자리에 놓음'; exception when others then raise notice '✅ 가진 개수보다 많이 못 놓음: %', sqlerrm; end $$;
do $$ begin perform student_set_decor(array['prop_hacker']); raise notice '❌ 없는 소품을 놓음'; exception when others then raise notice '✅ 없는 소품 막힘: %', sqlerrm; end $$;
do $$ begin perform student_set_decor(array['prop_name_sign', null, null, null]); raise notice '❌ 4자리'; exception when others then raise notice '✅ 4자리 막힘: %', sqlerrm; end $$;
set role authenticated;
do $$ begin update students set decor_counts = '{"prop_firefly_jar": 99}' where nickname = '민수'; raise notice '❌ 학생이 보유 개수를 직접 바꿈'; exception when others then raise notice '✅ 보유 개수 직접 수정 막힘(권한): %', sqlerrm; end $$;
reset role;
select '지우는 그대로 (빈 자리)' as t, decor_placed from students where nickname = '지우';
