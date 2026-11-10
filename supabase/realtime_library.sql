-- ============================================================
-- 새싹책방 2.0 · 3D 도서관·정원 실시간 접속 보안
-- ============================================================
-- 이 파일은 Supabase SQL Editor에서 한 번 실행합니다. 여러 번 실행해도 안전합니다.
-- 테이블·학생 데이터는 바꾸지 않습니다. 실시간 채널 "saesak-library-<학급 id>" 에
-- 그 학급의 학생과 담당 선생님만 들어올 수 있게 하는 접근 규칙만 추가합니다.
--
-- 실행 전: 앱은 비공개 채널을 먼저 시도하고, 안 되면 공개 채널로 대신 연결합니다(지금처럼 동작).
-- 실행 후: 비공개 채널이 열려, 반 학생·선생님이 아닌 사람은 접속 정보를 보거나 보낼 수 없습니다.
-- 주고받는 정보는 닉네임, 자리 번호, 상태(앉음·읽는 중·물 주는 중)뿐입니다.

-- 채널 이름에서 학급 id를 꺼내, 지금 로그인한 사람이 속한 학급인지 확인
create or replace function public.saesak_can_join_library(p_topic text)
returns boolean
language sql security definer stable set search_path = public as $$
  select p_topic like 'saesak-library-%'
     and substring(p_topic from 16) in (select id::text from my_class_ids() as id)
$$;

grant execute on function public.saesak_can_join_library(text) to anon, authenticated;

drop policy if exists "saesak_library_read" on realtime.messages;
create policy "saesak_library_read" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('presence', 'broadcast') and public.saesak_can_join_library(realtime.topic()));

drop policy if exists "saesak_library_write" on realtime.messages;
create policy "saesak_library_write" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('presence', 'broadcast') and public.saesak_can_join_library(realtime.topic()));
