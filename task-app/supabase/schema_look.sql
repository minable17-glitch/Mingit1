-- 업무 챙김 — 화면 꾸미기(강조색·글씨 크기·글씨 진하기·바탕) 설정 칸. 여러 번 실행해도 안전합니다.
alter table public.settings add column if not exists appearance jsonb not null default '{}'::jsonb;
