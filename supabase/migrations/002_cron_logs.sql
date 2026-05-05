CREATE TABLE cron_logs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz default now(),
  creators_scraped integer default 0,
  posts_added integer default 0,
  errors jsonb default '[]'
);

ALTER TABLE cron_logs DISABLE ROW LEVEL SECURITY;
