-- 업무 챙김 11 — 일지(플래너): 날짜마다 메모·교시별 기록(0~7교시)·하루 기록. schema_class.sql 다음에 실행. 여러 번 실행해도 안전합니다.
-- 체크리스트는 오늘 할 일(today_items)을 날짜별로 같이 씁니다.

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

create table if not exists public.planner_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  memo text not null default '',
  periods jsonb not null default '[]'::jsonb,
  reflection text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);
comment on table public.planner_days is 'task-keeper';
alter table public.planner_days enable row level security;
drop policy if exists owner_all on public.planner_days;
create policy owner_all on public.planner_days for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
