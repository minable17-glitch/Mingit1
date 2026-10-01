-- 업무 챙김 7 — 생각 노트(업무에 관한 생각·원칙·아이디어·배운 점). schema_push.sql 다음에 실행. 여러 번 실행해도 안전합니다.

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

create table if not exists public.thoughts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  kind text not null default 'thought' check (kind in ('thought', 'principle', 'idea', 'lesson')),
  category_id uuid references public.categories (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.thoughts is 'task-keeper';
create index if not exists thoughts_user_idx on public.thoughts (user_id, created_at desc);
alter table public.thoughts enable row level security;
drop policy if exists owner_all on public.thoughts;
create policy owner_all on public.thoughts for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
