-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- creators
-- ─────────────────────────────────────────
create table public.creators (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  linkedin_url    text not null,
  avatar_url      text,
  headline        text,
  followers_count integer default 0,
  is_active       boolean not null default true,
  last_scraped_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, linkedin_url)
);

alter table public.creators enable row level security;
create policy "Users manage their creators"
  on public.creators for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- scraped_posts
-- ─────────────────────────────────────────
create table public.scraped_posts (
  id                uuid primary key default uuid_generate_v4(),
  creator_id        uuid not null references public.creators(id) on delete cascade,
  linkedin_post_id  text,
  content           text not null,
  likes_count       integer not null default 0,
  comments_count    integer not null default 0,
  shares_count      integer not null default 0,
  posted_at         timestamptz,
  scraped_at        timestamptz not null default now(),
  unique (creator_id, linkedin_post_id)
);

alter table public.scraped_posts enable row level security;
create policy "Users read their creators posts"
  on public.scraped_posts for select
  using (
    exists (
      select 1 from public.creators c
      where c.id = creator_id and c.user_id = auth.uid()
    )
  );
create policy "Service role insert scraped_posts"
  on public.scraped_posts for insert
  with check (true);

-- ─────────────────────────────────────────
-- insights
-- ─────────────────────────────────────────
create table public.insights (
  id                       uuid primary key default uuid_generate_v4(),
  creator_id               uuid not null references public.creators(id) on delete cascade,
  analysis                 jsonb not null default '{}',
  tone                     text,
  topics                   text[] not null default '{}',
  posting_frequency        text,
  best_performing_themes   text[] not null default '{}',
  generated_at             timestamptz not null default now()
);

alter table public.insights enable row level security;
create policy "Users read their creators insights"
  on public.insights for select
  using (
    exists (
      select 1 from public.creators c
      where c.id = creator_id and c.user_id = auth.uid()
    )
  );
create policy "Service role manage insights"
  on public.insights for all
  with check (true);

-- ─────────────────────────────────────────
-- generated_posts
-- ─────────────────────────────────────────
create type post_status as enum ('draft', 'scheduled', 'published');

create table public.generated_posts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  creator_id   uuid references public.creators(id) on delete set null,
  content      text not null,
  status       post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  platform     text not null default 'linkedin',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.generated_posts enable row level security;
create policy "Users manage their generated posts"
  on public.generated_posts for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- creator_profile  (user's own LinkedIn profile)
-- ─────────────────────────────────────────
create table public.creator_profile (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade unique,
  name         text,
  headline     text,
  tone         text,
  topics       text[] not null default '{}',
  linkedin_url text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.creator_profile enable row level security;
create policy "Users manage their own profile"
  on public.creator_profile for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at_creators
  before update on public.creators
  for each row execute function public.set_updated_at();

create trigger set_updated_at_generated_posts
  before update on public.generated_posts
  for each row execute function public.set_updated_at();

create trigger set_updated_at_creator_profile
  before update on public.creator_profile
  for each row execute function public.set_updated_at();
