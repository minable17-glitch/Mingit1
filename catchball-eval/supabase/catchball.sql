-- 캐치볼 영상 평가: 수파베이스 쪽 설정 (새싹책방 테이블과 독립, 추가만 함)
-- 이 파일은 Supabase MCP 로 실제 프로젝트(ikljkokebcqaxpctcjpy)에 적용되었습니다. 참고/재적용용.
--
-- 구조
--   storage 버킷 catchball-videos (비공개, 50MB 제한): 학생이 올린 영상. 경로 = <업로더 auth uid>/<파일명>
--   catchball_submissions : 제출 목록 (반, 학생, 영상 경로, 촬영 중 자동 카운트, 상태)
--   catchball_results     : 선생님 채점 결과
--   catchball_teacher_sessions : "이 익명 세션은 어느 선생님인가" 매핑.
--       새싹책방의 teachers.auth_user_id 를 건드리지 않기 위해 따로 둠 (같은 브라우저에서 두 앱을 같이 써도 서로 로그인을 끊지 않음)
--
-- 접근 방식: 테이블은 RLS 를 켜고 정책을 두지 않음(직접 접근 불가). 모든 읽기/쓰기는 아래 RPC(security definer)로만.

create table if not exists catchball_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  eval_date date not null default (now() at time zone 'Asia/Seoul')::date,
  class_name text not null,
  student1 text not null,
  student2 text not null,
  storage_path text not null unique,
  file_name text,
  size_bytes bigint,
  mime_type text,
  duration_sec int,
  auto_success int,
  auto_fail int,
  auto_events jsonb,
  status text not null default '미채점',
  uploader_uid uuid
);

create table if not exists catchball_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submission_id uuid references catchball_submissions(id) on delete set null,
  teacher_id uuid references teachers(id) on delete set null,
  eval_date date,
  class_name text,
  student1 text,
  student2 text,
  success int not null default 0,
  fail int not null default 0,
  best_streak int not null default 0,
  duration_sec int,
  video_name text,
  memo text,
  events jsonb
);

create table if not exists catchball_teacher_sessions (
  auth_uid uuid primary key,
  teacher_id uuid not null references teachers(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table catchball_submissions enable row level security;
alter table catchball_results enable row level security;
alter table catchball_teacher_sessions enable row level security;

-- 현재 세션이 선생님인지
create or replace function catchball_current_teacher()
returns uuid
language sql security definer set search_path = public as $$
  select teacher_id from catchball_teacher_sessions where auth_uid = auth.uid();
$$;
grant execute on function catchball_current_teacher() to anon, authenticated;

-- 선생님 로그인 (새싹책방 선생님 계정 그대로. teachers.auth_user_id 는 건드리지 않음)
create or replace function catchball_teacher_login(p_username text, p_password text)
returns table(id uuid, username text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_teacher teachers%rowtype;
begin
  if auth.uid() is null then
    raise exception '세션이 없어요. 다시 시도해 주세요';
  end if;
  select * into v_teacher from teachers where teachers.username = p_username;
  if not found or v_teacher.password_hash <> crypt(p_password, v_teacher.password_hash) then
    raise exception '아이디 또는 비밀번호가 올바르지 않아요';
  end if;
  insert into catchball_teacher_sessions (auth_uid, teacher_id) values (auth.uid(), v_teacher.id)
    on conflict (auth_uid) do update set teacher_id = excluded.teacher_id, created_at = now();
  return query select teachers.id, teachers.username from teachers where teachers.id = v_teacher.id;
end;
$$;
grant execute on function catchball_teacher_login(text, text) to anon, authenticated;

-- 지금 세션의 선생님 정보 (없으면 빈 결과)
create or replace function catchball_me()
returns table(id uuid, username text)
language sql security definer set search_path = public as $$
  select t.id, t.username from teachers t where t.id = catchball_current_teacher();
$$;
grant execute on function catchball_me() to anon, authenticated;

create or replace function catchball_teacher_logout()
returns void
language sql security definer set search_path = public as $$
  delete from catchball_teacher_sessions where auth_uid = auth.uid();
$$;
grant execute on function catchball_teacher_logout() to anon, authenticated;

-- 학생: 영상을 올린 뒤 제출 기록. storage_path 는 반드시 자기 uid 폴더여야 함
create or replace function catchball_submit(
  p_eval_date date, p_class_name text, p_student1 text, p_student2 text,
  p_storage_path text, p_file_name text, p_size_bytes bigint, p_mime_type text, p_duration_sec int,
  p_auto_success int default null, p_auto_fail int default null, p_auto_events jsonb default null
)
returns table(id uuid, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '세션이 없어요. 페이지를 새로고침해 주세요';
  end if;
  if p_storage_path is null or position(auth.uid()::text || '/' in p_storage_path) <> 1 then
    raise exception '영상 경로가 올바르지 않아요';
  end if;
  if coalesce(trim(p_class_name), '') = '' or coalesce(trim(p_student1), '') = '' or coalesce(trim(p_student2), '') = '' then
    raise exception '반과 학생 이름을 모두 적어 주세요';
  end if;
  insert into catchball_submissions
    (eval_date, class_name, student1, student2, storage_path, file_name, size_bytes, mime_type, duration_sec, auto_success, auto_fail, auto_events, uploader_uid)
  values
    (coalesce(p_eval_date, (now() at time zone 'Asia/Seoul')::date), left(trim(p_class_name), 30), left(trim(p_student1), 20), left(trim(p_student2), 20),
     p_storage_path, left(p_file_name, 120), p_size_bytes, left(p_mime_type, 60), p_duration_sec, p_auto_success, p_auto_fail, p_auto_events, auth.uid())
  returning catchball_submissions.id into v_id;
  return query select s.id, s.created_at from catchball_submissions s where s.id = v_id;
end;
$$;
grant execute on function catchball_submit(date, text, text, text, text, text, bigint, text, int, int, int, jsonb) to anon, authenticated;

-- 선생님: 제출 목록
create or replace function catchball_list_submissions()
returns setof catchball_submissions
language sql security definer set search_path = public as $$
  select * from catchball_submissions
  where catchball_current_teacher() is not null
  order by created_at desc
  limit 500;
$$;
grant execute on function catchball_list_submissions() to anon, authenticated;

-- 선생님: 채점 결과 저장 (+ 제출 상태 갱신)
create or replace function catchball_save_result(
  p_submission_id uuid, p_eval_date date, p_class_name text, p_student1 text, p_student2 text,
  p_success int, p_fail int, p_best_streak int, p_duration_sec int, p_video_name text, p_memo text, p_events jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_teacher uuid := catchball_current_teacher();
  v_id uuid;
begin
  if v_teacher is null then
    raise exception '선생님 로그인이 필요해요';
  end if;
  insert into catchball_results
    (submission_id, teacher_id, eval_date, class_name, student1, student2, success, fail, best_streak, duration_sec, video_name, memo, events)
  values
    (p_submission_id, v_teacher, p_eval_date, left(p_class_name, 30), left(p_student1, 20), left(p_student2, 20),
     coalesce(p_success, 0), coalesce(p_fail, 0), coalesce(p_best_streak, 0), p_duration_sec, left(p_video_name, 120), left(p_memo, 300), p_events)
  returning id into v_id;
  if p_submission_id is not null then
    update catchball_submissions set status = '채점완료' where id = p_submission_id;
  end if;
  return v_id;
end;
$$;
grant execute on function catchball_save_result(uuid, date, text, text, text, int, int, int, int, text, text, jsonb) to anon, authenticated;

create or replace function catchball_list_results()
returns setof catchball_results
language sql security definer set search_path = public as $$
  select * from catchball_results
  where catchball_current_teacher() is not null
  order by created_at desc
  limit 1000;
$$;
grant execute on function catchball_list_results() to anon, authenticated;

create or replace function catchball_delete_result(p_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if catchball_current_teacher() is null then
    raise exception '선생님 로그인이 필요해요';
  end if;
  delete from catchball_results where id = p_id;
end;
$$;
grant execute on function catchball_delete_result(uuid) to anon, authenticated;

-- 선생님: 제출 기록 삭제 (영상 파일 자체는 클라이언트가 storage 에서 지움)
create or replace function catchball_delete_submission(p_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_path text;
begin
  if catchball_current_teacher() is null then
    raise exception '선생님 로그인이 필요해요';
  end if;
  delete from catchball_submissions where id = p_id returning storage_path into v_path;
  return v_path;
end;
$$;
grant execute on function catchball_delete_submission(uuid) to anon, authenticated;

-- ── storage ──────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catchball-videos', 'catchball-videos', false, 52428800, array['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska'])
on conflict (id) do nothing;

-- 올리기: 로그인(익명 포함)한 사람이 자기 uid 폴더에만
drop policy if exists "catchball upload own folder" on storage.objects;
create policy "catchball upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'catchball-videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 읽기/지우기: 선생님만
drop policy if exists "catchball teacher read" on storage.objects;
create policy "catchball teacher read" on storage.objects for select to authenticated
  using (bucket_id = 'catchball-videos' and public.catchball_current_teacher() is not null);

drop policy if exists "catchball teacher delete" on storage.objects;
create policy "catchball teacher delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catchball-videos' and public.catchball_current_teacher() is not null);
