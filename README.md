# Content Agent

An AI-powered LinkedIn content creation platform. Scrape top creators, analyze their content with Claude, and generate posts tailored to your profile.

## What it does

1. **Inspirations** — Add LinkedIn creators, scrape their last 30 posts via Apify, analyze each with Claude Haiku, and surface engagement insights (top hooks, formats, themes).
2. **Create** — A 3-step agent chat generates batches of posts injected with your profile and scraped insights.
3. **Calendar** — Drag-and-drop week/month view to schedule, validate, and publish posts.
4. **Daily cron** — Automatically re-scrapes all creators every morning at 08:00 UTC.

## Stack

- **Framework**: Next.js 14 App Router (TypeScript)
- **Styling**: Tailwind CSS
- **Database**: Supabase (Postgres, no RLS, service role key)
- **AI**: Anthropic SDK — Claude Haiku 4.5 (analysis), Claude Sonnet 4.6 (generation)
- **Scraping**: Apify actor `apify/linkedin-post-scraper`

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key — used client-side only for the URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used server-side, bypasses RLS |
| `ANTHROPIC_API_KEY` | Anthropic API key (`sk-ant-...`) |
| `APIFY_API_TOKEN` | Apify personal API token |
| `APP_SECRET` | Password to access the app (set anything, e.g. a random string) |
| `CRON_SECRET` | Secret token Vercel sends in the `Authorization` header for cron jobs |

Copy `.env.local.example` to `.env.local` and fill in all values.

## Deploying to Vercel

1. **Push your code** to a GitHub (or GitLab/Bitbucket) repository.

2. **Import the project** on [vercel.com/new](https://vercel.com/new). Select the repository and set the framework to **Next.js**.

3. **Add environment variables** in the Vercel project settings under *Settings → Environment Variables*. Add all seven variables from the table above.

4. **Deploy**. Vercel will detect `vercel.json` and register the daily cron job at `0 8 * * *` (08:00 UTC).

5. **Verify the cron** under *Settings → Cron Jobs* in your Vercel dashboard. You can trigger it manually from there to confirm it works.

## Applying Supabase migrations

Run migrations from the Supabase dashboard SQL editor, or with the Supabase CLI:

```bash
# Install CLI (if not already)
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations
supabase db push
```

Alternatively, paste the contents of each file in `supabase/migrations/` into the **SQL Editor** in your Supabase dashboard and run them in order:

1. `001_init.sql` — creates all tables
2. `002_cron_logs.sql` — adds the cron run log table

## Getting an Apify token

1. Sign up at [apify.com](https://apify.com) (free tier includes ~$5/month of compute).
2. Go to **Settings → Integrations** → copy your **Personal API token**.
3. Set it as `APIFY_API_TOKEN` in your environment variables.

The scraper uses the `apify/linkedin-post-scraper` actor. Each scrape run costs a small amount of Apify compute units (~$0.01–0.05 per creator depending on post count).

## Local development

```bash
cp .env.local.example .env.local
# Fill in .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first visit redirects to the password gate — use the value you set for `APP_SECRET`.
