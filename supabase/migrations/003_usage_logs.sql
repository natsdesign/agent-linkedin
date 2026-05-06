CREATE TABLE usage_logs (
  id uuid primary key default gen_random_uuid(),
  action text,          -- 'analyze' | 'generate' | 'regenerate'
  input_tokens integer,
  output_tokens integer,
  model text,
  cost_usd numeric(10,6),
  created_at timestamptz default now()
);

ALTER TABLE usage_logs DISABLE ROW LEVEL SECURITY;

CREATE TABLE apify_runs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid,
  run_id text,
  posts_scraped integer default 0,
  cost_usd numeric(10,6) default 0.002,
  created_at timestamptz default now()
);

ALTER TABLE apify_runs DISABLE ROW LEVEL SECURITY;