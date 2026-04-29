
-- Enable pg_net (HTTP calls from SQL) if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule process-email-invoices every 15 minutes
-- IMPORTANT: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with real values.
-- Run this manually via Supabase Dashboard → SQL Editor after deploying the Edge Function.
--
-- SELECT cron.schedule(
--   'process-email-invoices',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-email-invoices',
--     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- To check scheduled jobs:   SELECT * FROM cron.job;
-- To remove:                  SELECT cron.unschedule('process-email-invoices');
