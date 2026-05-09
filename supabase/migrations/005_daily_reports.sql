CREATE TABLE daily_reports (
  id uuid primary key default gen_random_uuid(),
  date date default current_date,
  new_posts_count integer default 0,
  top_post_content text,
  top_post_likes integer default 0,
  top_creator text,
  insights_summary text,
  recommendations text[],
  created_at timestamptz default now()
);
ALTER TABLE daily_reports DISABLE ROW LEVEL SECURITY;
