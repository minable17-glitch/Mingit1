-- 업무 챙김 3 — 범용 배포용 (schema.sql, schema_phase2.sql 다음에 실행). 여러 번 실행해도 안전합니다.
--  · 누구나 구글 로그인으로 가입 (관리자가 가입을 닫을 수도 있음)
--  · allowed_emails 는 이제 '관리자 이메일' 목록
--  · AI 기능과 고급 구글 연동(캘린더 즉시 반영·Gmail)은 관리자 또는 관리자가 켜 준 사용자만
--  · 캘린더 구독 링크(구글 심사 없이 마감을 구글 캘린더에 표시)

-- 안전장치: 업무 챙김 전용 프로젝트에서만 실행 (schema.sql 과 같은 규칙)
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
-- 1. 앱 전체 설정 (한 줄짜리)
-- ─────────────────────────────────────────────
create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  signup_open boolean not null default true
);
insert into public.app_config (id) values (1) on conflict do nothing;
comment on table public.app_config is 'task-keeper';
alter table public.app_config enable row level security;
-- 정책 없음: 아래 함수로만 읽고 바꿈

-- ─────────────────────────────────────────────
-- 2. 사용자 프로필 (관리자가 켜 주는 기능 표시)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  ai_enabled boolean not null default false,
  google_advanced boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'task-keeper';
alter table public.profiles enable row level security;
drop policy if exists own_read on public.profiles;
create policy own_read on public.profiles for select using (user_id = auth.uid());
-- 쓰기 정책 없음: 사용자가 자기 권한을 스스로 켤 수 없음 (아래 함수로만 변경)

alter table public.settings add column if not exists calendar_token text unique;

-- ─────────────────────────────────────────────
-- 3. 권한 판단 함수
-- ─────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 앱을 쓸 수 있는가: 관리자, 이미 가입한 사람, 또는 가입이 열려 있을 때 이메일이 있는 로그인 사용자
create or replace function public.is_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() ->> 'email', '') <> ''
    and (
      public.is_admin()
      or exists (select 1 from public.profiles where user_id = auth.uid())
      or coalesce((select signup_open from public.app_config where id = 1), true)
    );
$$;

create or replace function public.ai_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.profiles where user_id = auth.uid() and ai_enabled);
$$;

create or replace function public.google_advanced_allowed()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or exists (select 1 from public.profiles where user_id = auth.uid() and google_advanced);
$$;

-- 로그인할 때 앱이 부름: 가입 처리 + 내 권한 돌려주기
create or replace function public.my_profile()
returns json language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  if not public.is_allowed() then
    return json_build_object('allowed', false);
  end if;
  insert into public.profiles (user_id, email)
  values (auth.uid(), auth.jwt() ->> 'email')
  on conflict (user_id) do update set email = excluded.email
  returning * into p;
  return json_build_object(
    'allowed', true,
    'is_admin', public.is_admin(),
    'ai_enabled', public.ai_allowed(),
    'google_advanced', public.google_advanced_allowed()
  );
end $$;

-- ─────────────────────────────────────────────
-- 4. 관리자 기능
-- ─────────────────────────────────────────────
create or replace function public.admin_overview()
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return json_build_object(
    'signup_open', (select signup_open from public.app_config where id = 1),
    'users', coalesce((
      select json_agg(json_build_object(
        'email', p.email, 'ai_enabled', p.ai_enabled, 'google_advanced', p.google_advanced,
        'created_at', p.created_at,
        'active_tasks', (select count(*) from public.tasks t where t.user_id = p.user_id and t.status = 'active')
      ) order by p.created_at desc)
      from public.profiles p), '[]'::json)
  );
end $$;

create or replace function public.admin_set_signup_open(open boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.app_config set signup_open = open where id = 1;
end $$;

create or replace function public.admin_set_user_flags(target_email text, ai boolean, advanced boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.profiles set ai_enabled = ai, google_advanced = advanced
  where lower(email) = lower(target_email);
end $$;

-- 관리자 함수는 로그인 사용자만 부를 수 있게 (함수 안에서 관리자인지 다시 확인)
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_set_signup_open(boolean) from public, anon;
revoke execute on function public.admin_set_user_flags(text, boolean, boolean) from public, anon;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_set_signup_open(boolean) to authenticated;
grant execute on function public.admin_set_user_flags(text, boolean, boolean) to authenticated;
