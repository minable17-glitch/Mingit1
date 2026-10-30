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

-- 3) 회원 탈퇴: 로그인한 본인 계정과 모든 데이터를 지움 (위 표들은 on delete cascade 로 함께 삭제)
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 4) 카테고리 (사용자마다 따로)
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

drop policy if exists "categories: 본인 것만" on public.categories;
create policy "categories: 본인 것만" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 영상에 카테고리·채널 정보 추가 (카테고리를 지우면 그 영상들은 '미분류'가 됨)
alter table public.watch_items
  add column if not exists category_id   uuid references public.categories(id) on delete set null,
  add column if not exists channel_key   text,   -- 유튜브 채널 ID (없으면 채널 주소)
  add column if not exists channel_title text;

-- 5) 채널별 학습: 사용자가 영상을 다른 카테고리로 옮기면 "이 채널 → 이 카테고리"를 기억
create table if not exists public.channel_categories (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel_key text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (user_id, channel_key)
);

alter table public.channel_categories enable row level security;

drop policy if exists "channel_categories: 본인 것만" on public.channel_categories;
create policy "channel_categories: 본인 것만" on public.channel_categories
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 6) 영상 길이, 별점·메모, 정리 도우미용 칼럼
alter table public.watch_items
  add column if not exists duration_sec integer,                              -- 영상 길이(초)
  add column if not exists rating       smallint check (rating between 1 and 5), -- 다 본 뒤 별점
  add column if not exists memo         text check (char_length(memo) <= 500),   -- 다 본 뒤 한 줄 메모
  add column if not exists kept_at      timestamptz;                          -- 정리 도우미에서 "아직 볼래요"를 누른 시각

-- 7) 사용자 설정 (주간 정리 알림)
create table if not exists public.user_settings (
  user_id         uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  digest_enabled  boolean not null default false,
  digest_dow      smallint not null default 0 check (digest_dow between 0 and 6),   -- 0=일요일
  digest_hour     smallint not null default 20 check (digest_hour between 0 and 23),
  timezone        text not null default 'Asia/Seoul',
  app_url         text,                                                         -- 알림을 누르면 열 앱 주소
  last_digest_at  timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings: 본인 것만" on public.user_settings;
create policy "user_settings: 본인 것만" on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
