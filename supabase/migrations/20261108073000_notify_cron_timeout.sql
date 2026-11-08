-- The reminder cron called the notify function through pg_net with its default
-- 5 s timeout. A cold start of the function takes longer than that, so from
-- 06:15 UTC on 2026-11-08 every run was abandoned by the caller before it
-- answered (status null, timed_out true). Thirty seconds covers a cold start
-- with room. Already applied to production by hand the same morning; this file
-- is the record, and cron.alter_job is idempotent if it runs again.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'accent-notify'),
  command := $cmd$
  select net.http_post(
    url := 'https://uazcoxinsnkjjogfovlg.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-key', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_secret')),
    body := '{"source":"cron"}'::jsonb,
    timeout_milliseconds := 30000);
$cmd$);
