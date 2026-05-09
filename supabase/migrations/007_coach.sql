CREATE TABLE coach_knowledge (
  id uuid primary key default gen_random_uuid(),
  category text, -- 'algo_linkedin' | 'pattern_personnel' | 'tendance_niche' | 'feedback'
  content text not null,
  source text, -- 'system' | 'auto_detected' | 'user_feedback'
  confidence_score numeric(3,2) default 0.80,
  validated boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE TABLE coach_predictions (
  id uuid primary key default gen_random_uuid(),
  week_start date,
  prediction text,
  prediction_type text, -- 'format' | 'hook' | 'timing' | 'sujet'
  expected_improvement numeric(5,2),
  actual_improvement numeric(5,2),
  was_correct boolean,
  created_at timestamptz default now()
);

CREATE TABLE coach_feedback (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid references coach_knowledge(id),
  feedback text check (feedback in ('worked', 'didnt_work', 'neutral')),
  context text,
  created_at timestamptz default now()
);

CREATE TABLE coach_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date,
  analysis text,
  recommendations jsonb default '[]',
  learnings jsonb default '[]',
  predictions jsonb default '[]',
  data_snapshot jsonb,
  created_at timestamptz default now()
);

ALTER TABLE coach_knowledge DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_predictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE coach_reports DISABLE ROW LEVEL SECURITY;
