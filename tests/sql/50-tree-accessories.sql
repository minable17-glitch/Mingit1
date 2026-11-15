-- 나무 악세서리 18종 SQL 점검: 00-local-stubs.sql → supabase/schema.sql → supabase/tree_accessories.sql(두 번) → 이 파일
insert into classes (id, code, name, admin_password_hash) values ('11111111-1111-1111-1111-111111111111', 'TA1', '1반', 'x');
insert into students (id, class_id, nickname, pin_hash, auth_user_id, accessory_counts) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '민수', 'x', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"apple": 1}');
select grant_accessories('22222222-2222-2222-2222-222222222222', 2000);
select '2000개 중 기본(약 65%)' as t, round(100.0 * sum(value::int) filter (where key in ('apple','butterfly','bell','heart','blossom','clover')) / 2000) - 0 as pct from students, jsonb_each_text(accessory_counts) where nickname = '민수';
select '귀함(약 8%)' as t, round(100.0 * sum(value::int) filter (where key in ('crown','rainbow','snowflake','bird')) / 2000) as pct from students, jsonb_each_text(accessory_counts) where nickname = '민수';
select '새 3종도 나옴 (3)' as t, count(*) from students, jsonb_each_text(accessory_counts) where nickname = '민수' and key in ('clover','acorn','bird');
set test.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select student_set_equipped(array['clover', 'bird', 'apple']);
select '새 악세서리 달기 (["clover", "bird", "apple"])' as t, equipped_accessories from students where nickname = '민수';
do $$ begin perform student_set_equipped(array['dragon']); raise notice '❌ 없는 악세서리'; exception when others then raise notice '✅ 없는 악세서리 막힘: %', sqlerrm; end $$;
