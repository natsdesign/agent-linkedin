-- my_posts: tracks the user's own published LinkedIn posts
CREATE TABLE IF NOT EXISTS my_posts (
  id              uuid primary key default gen_random_uuid(),
  content         text not null,
  published_at    timestamptz,
  likes           integer default 0,
  comments        integer default 0,
  shares          integer default 0,
  views           integer default 0,
  engagement_rate numeric(6,3),
  hook_type       text,
  format          text,
  themes          text[],
  post_url        text,
  created_at      timestamptz default now()
);
ALTER TABLE my_posts DISABLE ROW LEVEL SECURITY;

-- Add linkedin_url to creator_profile if it doesn't exist
ALTER TABLE creator_profile
  ADD COLUMN IF NOT EXISTS linkedin_url text;
