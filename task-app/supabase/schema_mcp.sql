-- 업무 챙김 5 — AI 채팅 커넥터(MCP) 연결 키. schema_links.sql 다음에 실행. 여러 번 실행해도 안전합니다.
-- 키는 앱 설정 화면에서 사용자가 직접 만들고, 서버 함수(mcp)만 이 키로 주인을 찾습니다.

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

alter table public.settings add column if not exists mcp_token text unique;
