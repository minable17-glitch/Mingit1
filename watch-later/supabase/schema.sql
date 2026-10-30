-- 나중에 볼 영상 알림 앱 — 테이블/보안 규칙
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요. (여러 번 실행해도 안전)

-- 1) 나중에 볼 영상 목록
create table if not exists public.watch_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url           text not null,
  video_id      text,
  title         text,
  thumbnail_url text,
  remind_at     timestamptz,          -- 알림 받을 시각 (없으면 알림 없이 저장)
  notified_at   timestamptz,          -- 알림을 처리한 시각 (null 이면 아직 안 보냄)
  notify_status text,                 -- 'sent' | 'no_device' | 'failed'
  watched_at    timestamptz,          -- 시청 완료 시각 (null 이면 아직 안 봄)
  created_at    timestamptz not null default now()
);

create index if not exists watch_items_user_idx on public.watch_items (user_id, created_at desc);
create index if not exists watch_items_due_idx on public.watch_items (remind_at)
  where notified_at is null and watched_at is null;

alter table public.watch_items enable row level security;

drop policy if exists "watch_items: 본인 것만" on public.watch_items;
create policy "watch_items: 본인 것만" on public.watch_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 2) 알림 받을 기기(브라우저) 목록 — 휴대폰, PC 등 기기마다 한 줄
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: 본인 것만" on public.push_subscriptions;
create policy "push_subscriptions: 본인 것만" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
