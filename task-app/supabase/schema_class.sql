-- 업무 챙김 10 — 학급(담임): 명렬표, 조회·종례 전달사항, 출결, 특이사항. schema_throw.sql 다음에 실행. 여러 번 실행해도 안전합니다.
-- 학생 정보는 본인만 볼 수 있습니다(행 단위 보안). AI 채팅 커넥터로는 내보내지 않습니다. 탈퇴하면 함께 지워집니다.

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

-- 명렬표 (번호·이름만)
create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number int not null check (number between 0 and 999),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists class_students_user_idx on public.class_students (user_id, number);
comment on table public.class_students is 'task-keeper';
alter table public.class_students enable row level security;
drop policy if exists owner_all on public.class_students;
create policy owner_all on public.class_students for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 조회·종례 전달사항
create table if not exists public.class_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('morning', 'closing')),
  body text not null check (length(trim(body)) > 0),
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists class_notices_day_idx on public.class_notices (user_id, day);
comment on table public.class_notices is 'task-keeper';
alter table public.class_notices enable row level security;
drop policy if exists owner_all on public.class_notices;
create policy owner_all on public.class_notices for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 출결 (결석·지각·조퇴·결과 × 질병·미인정·기타·출석인정)
create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.class_students (id) on delete cascade,
  day date not null,
  type text not null check (type in ('absent', 'late', 'early', 'result')),
  reason text not null default 'sick' check (reason in ('sick', 'unexcused', 'etc', 'approved')),
  memo text,
  created_at timestamptz not null default now(),
  unique (student_id, day, type)
);
create index if not exists class_attendance_day_idx on public.class_attendance (user_id, day);
comment on table public.class_attendance is 'task-keeper';
alter table public.class_attendance enable row level security;
drop policy if exists owner_all on public.class_attendance;
create policy owner_all on public.class_attendance for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());

-- 학생 특이사항
create table if not exists public.class_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id uuid not null references public.class_students (id) on delete cascade,
  day date not null,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists class_notes_idx on public.class_notes (user_id, day desc);
comment on table public.class_notes is 'task-keeper';
alter table public.class_notes enable row level security;
drop policy if exists owner_all on public.class_notes;
create policy owner_all on public.class_notes for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
