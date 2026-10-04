-- 업무 챙김 8 — 오늘 할 일(내가 따로 정리하는 오늘 목록). schema_notes.sql 다음에 실행. 여러 번 실행해도 안전합니다.

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

create table if not exists public.today_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  title text not null check (length(trim(title)) > 0),
  task_id uuid references public.tasks (id) on delete set null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.today_items is 'task-keeper';
create index if not exists today_items_day_idx on public.today_items (user_id, day);
alter table public.today_items enable row level security;
drop policy if exists owner_all on public.today_items;
create policy owner_all on public.today_items for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
