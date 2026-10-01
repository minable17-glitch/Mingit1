-- 업무 챙김 6 — 시간 알림(웹 푸시). schema_mcp.sql 다음에 실행. 여러 번 실행해도 안전합니다.
-- 정해 둔 시간이 되면 서버(push 함수)가 1분마다 확인해서 휴대폰·컴퓨터로 알림을 보냅니다.
-- 1분마다 확인하는 예약 작업은 GitHub 배포 작업이 함수 주소에 맞춰 자동으로 등록합니다.

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

-- 알림을 받을 기기 (브라우저마다 하나)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
comment on table public.push_subscriptions is 'task-keeper';
alter table public.push_subscriptions enable row level security;
drop policy if exists owner_all on public.push_subscriptions;
create policy owner_all on public.push_subscriptions for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 알림 (업무에 딸린 것, 업무가 지워지면 같이 지워짐)
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  remind_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.reminders is 'task-keeper';
create index if not exists reminders_due_idx on public.reminders (remind_at) where sent_at is null;
alter table public.reminders enable row level security;
drop policy if exists owner_all on public.reminders;
create policy owner_all on public.reminders for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 서버 전용 설정 (알림 서명 키 등). 정책이 없어서 앱에서는 읽을 수 없고 서버 함수만 씁니다.
create table if not exists public.server_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
comment on table public.server_config is 'task-keeper';
alter table public.server_config enable row level security;
