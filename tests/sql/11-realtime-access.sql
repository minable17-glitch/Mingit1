insert into teachers (id, username, password_hash, auth_user_id) values ('00000000-0000-0000-0000-0000000000a1', 't', 'x', '00000000-0000-0000-0000-0000000000f1');
insert into classes (id, name, code, teacher_id) values ('00000000-0000-0000-0000-0000000000c1', '3-2', 'A1', '00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000c2', '3-3', 'A2', null);
insert into students (id, class_id, nickname, pin_hash, auth_user_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', '가', 'x', '00000000-0000-0000-0000-0000000000e1'), ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000c2', '남의반', 'x', '00000000-0000-0000-0000-0000000000e9');
grant select on students, classes, teachers to authenticated;
create or replace function try_join(p_uid text, p_topic text) returns text language plpgsql as $$
declare ok boolean; begin
  perform set_config('test.uid', coalesce(p_uid, ''), true); perform set_config('realtime.topic', p_topic, true);
  set local role authenticated;
  begin insert into realtime.messages (topic, extension, payload) values (p_topic, 'presence', '{}'); ok := true; exception when others then ok := false; end;
  reset role; return case when ok then '들어갈 수 있음' else '막힘' end;
end $$;
select '3-2반 학생이 3-2반 도서관: ' || try_join('00000000-0000-0000-0000-0000000000e1', 'saesak-library-00000000-0000-0000-0000-0000000000c1');
select '3-2반 담당 선생님이 3-2반 도서관: ' || try_join('00000000-0000-0000-0000-0000000000f1', 'saesak-library-00000000-0000-0000-0000-0000000000c1');
select '다른 반 학생이 3-2반 도서관: ' || try_join('00000000-0000-0000-0000-0000000000e9', 'saesak-library-00000000-0000-0000-0000-0000000000c1');
select '로그인 안 한 사람이 3-2반 도서관: ' || try_join(null, 'saesak-library-00000000-0000-0000-0000-0000000000c1');
select '3-2반 학생이 다른 이름 채널: ' || try_join('00000000-0000-0000-0000-0000000000e1', 'something-else');
