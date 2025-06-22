
-- Enable necessary extensions for cron jobs
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Grant usage permissions
grant usage on schema cron to postgres;
grant usage on schema net to postgres;

-- Grant table and sequence permissions for cron job management
grant all on all tables in schema cron to postgres;
grant all on all sequences in schema cron to postgres;

-- Schedule the 'generate-blog-post' function to run once a day at midnight UTC.
-- If a job with the same name exists, it will be updated.
select
cron.schedule(
  'generate-daily-blog-post',
  '0 0 * * *', -- This means "at minute 0 of hour 0 every day"
  $$
  select
    net.http_post(
        url:='https://jkobyxmrzqxhtuqxcudy.supabase.co/functions/v1/generate-blog-post',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb2J5eG1yenF4aHR1cXhjdWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4OTUwODEsImV4cCI6MjA2NTQ3MTA4MX0.qw0NGAoLmg6kpvAyQKLvySwM6cBPfWKeroN1sP81m6E"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);
