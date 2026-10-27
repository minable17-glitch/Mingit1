-- 업무 챙김 — 첨부(캡처 사진·파일). 업무나 던져 둔 것에 붙임. 파일은 비공개 저장소 task-files 의 "본인 ID/" 폴더에만. 여러 번 실행해도 안전합니다.

-- 안전장치: 업무 챙김 전용 프로젝트에서만 실행
do $$
declare others text;
begin
  select string_agg(table_name, ', ' order by table_name) into others
  from information_schema.tables
  where table_schema = 'public'
    and obj_description(format('public.%I', table_name)::regclass, 'pg_class') is distinct from 'task-keeper';
  if others is not null then
    raise exception '다른 앱이 쓰고 있는 프로젝트입니다 (이미 있는 표: %). 업무 챙김용으로 새로 만든 빈 프로젝트의 SQL Editor에서 실행하세요. 아무것도 바뀌지 않았습니다.', others;
  end if;
end $$;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  throw_id uuid references public.throw_items (id) on delete set null,
  path text not null unique,          -- 저장소 안 위치: <user_id>/<무작위>.<확장자> (한글 이름은 저장소 키로 못 써서 name 에 따로)
  name text not null,                 -- 원래 파일 이름
  mime text not null default '',
  size int not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.attachments is 'task-keeper';
create index if not exists attachments_task_idx on public.attachments (task_id);
create index if not exists attachments_throw_idx on public.attachments (throw_id);
alter table public.attachments enable row level security;
drop policy if exists owner_all on public.attachments;
create policy owner_all on public.attachments for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 비공개 파일 저장소: 한 파일 20MB까지, 본인 폴더만 읽기·쓰기
-- (저장소 권한 문제로 실패해도 위의 표 설치는 그대로 되도록 따로 묶음. 배포 작업의 '첨부 저장소 확인' 단계가 결과를 보여 줌)
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('task-files', 'task-files', false, 20971520)
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

  drop policy if exists task_keeper_files_owner on storage.objects;
  create policy task_keeper_files_owner on storage.objects for all to authenticated
    using (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed())
    with check (bucket_id = 'task-files' and (storage.foldername(name))[1] = auth.uid()::text and public.is_allowed());
exception when others then
  raise warning '첨부 저장소 준비 실패: %', sqlerrm;
end $$;
