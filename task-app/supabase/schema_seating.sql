-- 업무 챙김 — 🪑 자리 배치(학급). 설정·현재 배치·비밀 지정석·저장 기록을 한 줄(jsonb)로. 본인만 보기. 여러 번 실행해도 안전합니다.

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


create table if not exists public.class_seating (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- { rows, cols, fillFront, useHistory, students, avoid, current, secret, records: [{ id, title, date, rows, cols, grid }] }
  updated_at timestamptz not null default now()
);
comment on table public.class_seating is 'task-keeper';
alter table public.class_seating enable row level security;
drop policy if exists owner_all on public.class_seating;
create policy owner_all on public.class_seating for all
  using (user_id = auth.uid() and public.is_allowed())
  with check (user_id = auth.uid() and public.is_allowed());
