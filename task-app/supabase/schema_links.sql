-- 업무 챙김 4 — 업무 연결(선후 관계). schema_public.sql 다음에 실행. 여러 번 실행해도 안전합니다.
-- "A를 끝내야 B를 할 수 있다" = from_task_id(A) → to_task_id(B)

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

create table if not exists public.task_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  from_task_id uuid not null references public.tasks (id) on delete cascade,
  to_task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (from_task_id, to_task_id),
  check (from_task_id <> to_task_id)
);
comment on table public.task_links is 'task-keeper';
alter table public.task_links enable row level security;
drop policy if exists owner_all on public.task_links;
create policy owner_all on public.task_links for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
