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
