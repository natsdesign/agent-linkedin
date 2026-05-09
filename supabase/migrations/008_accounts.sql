CREATE TABLE accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar_url text,
  type text check (type in ('personal', 'client')) default 'personal',
  niche text,
  tone text,
  target_audience text,
  goals text[],
  posting_frequency integer default 3,
  linkedin_url text,
  system_prompt text,
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;

-- Ajoute account_id sur toutes les tables existantes
ALTER TABLE creators ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE scraped_posts ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE generated_posts ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE my_posts ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE insights ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE coach_reports ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE coach_knowledge ADD COLUMN account_id uuid references accounts(id) on delete cascade;
ALTER TABLE daily_reports ADD COLUMN account_id uuid references accounts(id) on delete cascade;

-- Migre les données existantes vers un compte par défaut
INSERT INTO accounts (id, name, type, onboarding_completed)
VALUES ('00000000-0000-0000-0000-000000000001', 'Mon compte', 'personal', true);

UPDATE creators SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE generated_posts SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE my_posts SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE insights SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE coach_reports SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE coach_knowledge SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
UPDATE daily_reports SET account_id = '00000000-0000-0000-0000-000000000001' WHERE account_id IS NULL;
