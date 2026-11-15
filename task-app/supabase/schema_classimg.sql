-- 업무 챙김 — 학급 그림(조회·종례 전달사항, 학생 특이사항, 일지에 붙인 캡처). 파일은 비공개 저장소 task-files 의 "본인 ID/" 폴더에만(schema_files.sql). 본인만 봄. 여러 번 실행해도 안전합니다.

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

create table if not exists public.class_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('morning', 'closing', 'notes', 'planner')),
  day date not null,
  note_id uuid references public.class_notes (id) on delete cascade, -- 특이사항 그림이면 그 기록
  path text not null unique,
  name text not null,
  mime text not null default '',
  size int not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.class_images is 'task-keeper';
create index if not exists class_images_day_idx on public.class_images (user_id, kind, day);
create index if not exists class_images_note_idx on public.class_images (note_id);
alter table public.class_images enable row level security;
drop policy if exists owner_all on public.class_images;
create policy owner_all on public.class_images for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
