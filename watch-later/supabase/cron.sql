-- 나중에 볼 영상 알림 앱 — 1분마다 알림 확인 예약 실행
-- schema.sql 을 먼저 실행하고, 서버 함수(send-due-reminders)를 배포한 뒤 실행하세요.
--
-- 아래 두 군데의 <...> 를 바꾼 뒤 SQL Editor 에서 Run 하세요.
--   <PROJECT_REF>   : Supabase 프로젝트 주소의 앞부분 (예: https://abcd1234.supabase.co 이면 abcd1234)
--   <CRON_SECRET>   : 서버 함수 비밀값으로 넣은 CRON_SECRET 과 똑같은 값

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 비밀값은 Vault 에 보관 (이미 있으면 먼저 지우고 다시 만듦)
delete from vault.secrets where name in ('watch_later_function_url', 'watch_later_cron_secret');
select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/send-due-reminders', 'watch_later_function_url');
select vault.create_secret('<CRON_SECRET>', 'watch_later_cron_secret');

-- 1분마다: 알림 시간이 된 영상이 "있을 때만" 서버 함수를 부름
-- (보낼 게 없으면 함수를 부르지 않으므로 무료 호출량을 아낌)
select cron.schedule(
  'watch-later-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'watch_later_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'watch_later_cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (
    select 1 from public.watch_items
    where remind_at <= now() and notified_at is null and watched_at is null
  );
  $$
);

-- 매시 정각: 주간 정리 알림 (각자 정한 요일·시각이 된 사람에게만 보냄)
select cron.schedule(
  'watch-later-weekly-digest',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'watch_later_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'watch_later_cron_secret')
    ),
    body := '{"mode":"digest"}'::jsonb
  )
  where exists (select 1 from public.user_settings where digest_enabled);
  $$
);

-- 확인: select * from cron.job;
-- 실행 기록: select * from cron.job_run_details order by start_time desc limit 20;
-- 멈추기:   select cron.unschedule('watch-later-reminders'); select cron.unschedule('watch-later-weekly-digest');
