-- 캐릭터 꾸미기 SQL 점검: 00-local-stubs.sql → supabase/schema.sql → supabase/avatar_dress.sql(두 번) → 이 파일
-- 각 줄 끝 괄호 안이 기대값
insert into classes (id, code, name, admin_password_hash) values ('11111111-1111-1111-1111-111111111111', 'AVT1', '시험반', 'x');
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '민수', 'x', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '지우', 'x', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set test.uid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select student_set_avatar('{"g":"girl","hs":"pigtails","hc":2,"sc":4,"b":"skirt","bc":3,"evil":"x"}');
select '저장됨 + 모르는 키는 버림 (girl/pigtails/4, evil 없음)' as t, avatar ->> 'g', avatar ->> 'hs', avatar ->> 'sc', avatar ? 'evil' from students where nickname = '민수';
select '지우는 그대로 (빈칸)' as t, avatar from students where nickname = '지우';
do $$ begin perform student_set_avatar('{"g":"robot","hs":"short","hc":0,"sc":0,"b":"shorts","bc":0}'); raise notice '❌ 이상한 성별이 저장됨'; exception when others then raise notice '✅ 이상한 성별 막힘: %', sqlerrm; end $$;
do $$ begin perform student_set_avatar('{"g":"boy","hs":"short","hc":9,"sc":0,"b":"shorts","bc":0}'); raise notice '❌ 범위 밖 색이 저장됨'; exception when others then raise notice '✅ 범위 밖 색 막힘: %', sqlerrm; end $$;
do $$ begin perform student_set_avatar('{"g":"boy","hs":"short","hc":"a","sc":0,"b":"shorts","bc":0}'); raise notice '❌ 숫자 아닌 색이 저장됨'; exception when others then raise notice '✅ 숫자 아닌 색 막힘: %', sqlerrm; end $$;
set test.uid = '';
do $$ begin perform student_set_avatar('{"g":"boy","hs":"short","hc":0,"sc":0,"b":"shorts","bc":0}'); raise notice '❌ 로그인 안 한 사람이 저장함'; exception when others then raise notice '✅ 로그인 안 하면 막힘: %', sqlerrm; end $$;
select '민수 모습 그대로 (pigtails)' as t, avatar ->> 'hs' from students where nickname = '민수';
