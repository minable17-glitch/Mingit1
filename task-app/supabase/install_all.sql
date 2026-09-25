-- 업무 챙김 한 번에 설치 (schema.sql + schema_phase2.sql + 본인 이메일 등록)
-- 업무 챙김용 새 Supabase 프로젝트의 SQL Editor에 전체를 붙여넣고 Run 한 번. 여러 번 실행해도 안전합니다.
-- ※ schema.sql / schema_phase2.sql 을 고치면 이 파일도 같이 고쳐야 합니다.

-- 업무 놓침 방지 앱 (1단계 MVP) — Supabase 스키마
-- 새 Supabase 프로젝트의 SQL Editor에 이 파일 전체를 붙여넣고 한 번 실행합니다.
-- 여러 번 실행해도 안전하도록 if not exists / or replace 를 씁니다.

-- 안전장치: 업무 챙김 전용 프로젝트에서만 실행됩니다.
-- 새싹책방·양궁 성장일지 등 다른 앱의 표가 하나라도 있는 프로젝트라면 아무것도 바꾸지 않고 멈춥니다.
-- (업무 챙김이 만든 표에는 'task-keeper' 표시를 달아 두고, 표시 없는 표가 있으면 다른 앱으로 봅니다.
--  이름이 같은 표가 우연히 있어도 표시가 없으므로 멈춥니다.)
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

alter database postgres set timezone to 'Asia/Seoul';

-- ─────────────────────────────────────────────
-- 0. 본인 계정만 허용
-- ─────────────────────────────────────────────
-- 이 표에 들어 있는 이메일로 로그인한 사람만 데이터를 읽고 쓸 수 있습니다.
-- 설치 후 아래 한 줄을 본인 이메일로 바꿔 실행하세요.
--   insert into public.allowed_emails (email) values ('본인@gmail.com');
create table if not exists public.allowed_emails (
  email text primary key
);
comment on table public.allowed_emails is 'task-keeper';
alter table public.allowed_emails enable row level security;
-- 정책을 만들지 않으므로 앱에서는 이 표를 읽을 수 없고, 아래 함수만 확인합니다.

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ─────────────────────────────────────────────
-- 1. 분류
-- ─────────────────────────────────────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null default '#4f7cff',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2. 업무
-- ─────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  -- 분류 삭제 시 업무를 다른 분류로 먼저 옮기도록 restrict
  category_id uuid not null references public.categories (id) on delete restrict,
  due_date date,
  status text not null default 'active' check (status in ('active', 'done')),
  next_action text not null default '',
  latest_note text,
  last_activity_at timestamptz not null default now(),
  calendar_event_id text,
  calendar_dirty boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  -- 진행 중인 업무에는 다음 행동이 비어 있으면 안 됨
  constraint active_task_has_next_action
    check (status <> 'active' or length(trim(next_action)) > 0)
);
create index if not exists tasks_user_status_idx on public.tasks (user_id, status);

-- ─────────────────────────────────────────────
-- 3. 단계
-- ─────────────────────────────────────────────
create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  position int not null default 0,
  title text not null check (length(trim(title)) > 0),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  calendar_event_id text
);
create index if not exists steps_task_idx on public.steps (task_id, position);

-- ─────────────────────────────────────────────
-- 4. 활동 기록
-- ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('create', 'check', 'note', 'edit', 'complete')),
  content text
);
create index if not exists activity_task_idx on public.activity_log (task_id, at desc);

-- ─────────────────────────────────────────────
-- 5. 설정 (방치 기준일 등)
-- ─────────────────────────────────────────────
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  neglect_days int not null default 3 check (neglect_days between 1 and 60),
  calendar_steps boolean not null default true
);

-- ─────────────────────────────────────────────
-- 6. 구글 갱신 토큰 (캘린더 연동용)
-- ─────────────────────────────────────────────
create table if not exists public.google_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7. 행 단위 보안: 본인 행만, 허용된 이메일만
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['categories', 'tasks', 'steps', 'activity_log', 'settings', 'google_tokens']
  loop
    execute format('comment on table public.%I is %L', t, 'task-keeper');
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all
         using (user_id = auth.uid() and public.is_allowed())
         with check (user_id = auth.uid() and public.is_allowed())', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 8. 주 1회 백업 예약 (선택)
-- ─────────────────────────────────────────────
-- Edge Function `weekly-backup` 배포 후, 대시보드 Database → Extensions 에서
-- pg_cron, pg_net 을 켜고 아래를 본인 값으로 바꿔 실행하세요.
-- (<PROJECT_REF>, <BACKUP_SECRET> 은 README 참고)
--
-- select cron.schedule(
--   'weekly-backup',
--   '0 18 * * 0',   -- 매주 일요일 18:00 UTC = 월요일 03:00 KST
--   $$ select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weekly-backup',
--        headers := jsonb_build_object('x-backup-secret', '<BACKUP_SECRET>')
--      ) $$
-- );

-- 업무 챙김 2단계 — schema.sql 을 실행한 뒤 이 파일을 SQL Editor 에서 한 번 실행합니다.
-- 여러 번 실행해도 안전합니다.

-- 안전장치: 업무 챙김 전용 프로젝트에서만 실행됩니다.
-- 새싹책방·양궁 성장일지 등 다른 앱의 표가 하나라도 있는 프로젝트라면 아무것도 바꾸지 않고 멈춥니다.
-- (업무 챙김이 만든 표에는 'task-keeper' 표시를 달아 두고, 표시 없는 표가 있으면 다른 앱으로 봅니다.
--  이름이 같은 표가 우연히 있어도 표시가 없으므로 멈춥니다.)
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

-- ─────────────────────────────────────────────
-- 1. 공 넘겨놓은 일 (결재·회신 대기)
-- ─────────────────────────────────────────────
alter table public.tasks
  add column if not exists waiting_on text,          -- 누구/무엇을 기다리는지 (예: 교감 결재)
  add column if not exists waiting_since timestamptz; -- 공을 넘긴 시각

alter table public.activity_log drop constraint if exists activity_log_kind_check;
alter table public.activity_log add constraint activity_log_kind_check
  check (kind in ('create', 'check', 'note', 'edit', 'complete', 'wait', 'reply'));

-- ─────────────────────────────────────────────
-- 2. 설정 추가
-- ─────────────────────────────────────────────
alter table public.settings
  add column if not exists waiting_days int not null default 3 check (waiting_days between 1 and 60),
  add column if not exists gmail_label text not null default '업무',
  add column if not exists widget_token text unique,
  -- 종 시간표: [{ "period": 1, "start": "09:00", "end": "09:45" }, ...]
  add column if not exists bell_schedule jsonb not null default '[
    {"period": 1, "start": "09:00", "end": "09:45"},
    {"period": 2, "start": "09:55", "end": "10:40"},
    {"period": 3, "start": "10:50", "end": "11:35"},
    {"period": 4, "start": "11:45", "end": "12:30"},
    {"period": 5, "start": "13:30", "end": "14:15"},
    {"period": 6, "start": "14:25", "end": "15:10"},
    {"period": 7, "start": "15:20", "end": "16:05"}
  ]'::jsonb,
  -- 수업이 있는 교시: { "1": [1, 3], "2": [2, 4, 5], ... }  (1=월 … 5=금)
  add column if not exists timetable jsonb not null default '{}'::jsonb,
  add column if not exists templates_seeded boolean not null default false;

-- ─────────────────────────────────────────────
-- 3. 자주 하는 업무 템플릿
-- ─────────────────────────────────────────────
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category_id uuid references public.categories (id) on delete set null,
  -- [{ "title": "견적 받기", "offset_days": -7 }]  offset_days = 최종 마감 기준 며칠 전(음수)/후
  steps jsonb not null default '[]'::jsonb,
  next_action text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 4. 받은 제안함 (Gmail 라벨에서 가져온 메일 → AI가 만든 업무 제안)
-- ─────────────────────────────────────────────
create table if not exists public.inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null default 'gmail',
  source_id text not null,        -- Gmail 메시지 ID (중복 가져오기 방지)
  subject text,
  sender text,
  received_at timestamptz,
  proposal jsonb,                 -- AI가 뽑은 업무 제안
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id, source, source_id)
);

-- ─────────────────────────────────────────────
-- 5. 주간 회고 기록
-- ─────────────────────────────────────────────
create table if not exists public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  summary text not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ─────────────────────────────────────────────
-- 6. 행 단위 보안
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['templates', 'inbox', 'weekly_reviews']
  loop
    execute format('comment on table public.%I is %L', t, 'task-keeper');
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all
         using (user_id = auth.uid() and public.is_allowed())
         with check (user_id = auth.uid() and public.is_allowed())', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 7. Gmail 주기적 확인 예약 (선택)
-- ─────────────────────────────────────────────
-- gmail-import 함수 배포 후 pg_cron, pg_net 을 켜고 본인 값으로 바꿔 실행.
-- 매시 정각에 라벨 메일을 확인합니다. 새 메일이 있을 때만 AI를 부르므로 비용은 메일 수에 비례합니다.
--
-- select cron.schedule(
--   'gmail-import',
--   '0 * * * *',
--   $$ select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/gmail-import',
--        headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>')
--      ) $$
-- );

-- 본인 이메일 등록 (이 이메일로 로그인한 사람만 앱을 쓸 수 있음)
insert into public.allowed_emails (email) values ('minable7@gmail.com') on conflict do nothing;
