# content-agent — Context for Claude Code

This file gives a complete picture of the project so you can pick up any task without reading all the source files first.

---

## What the app does

**content-agent** is a mono-user Next.js 14 web app for LinkedIn content creation:

1. **Inspirations** — Add LinkedIn creators (competitors, top creators, influencers), scrape their last 30 posts via Apify (async with polling), analyze each post with Claude Haiku, and aggregate engagement insights. Creator cards show profile pictures extracted from Apify responses.
2. **Create** — A 3-question agent chat (topics → tone → count/format) calls Claude Sonnet to batch-generate posts injected with the user's profile and scraped insights. Each post has a copy-to-clipboard button.
3. **Calendar** — Drag-and-drop (dnd-kit) week/month view to schedule, edit, validate, publish, and delete posts. Post detail modal has a copy-to-clipboard button.
4. **Mon compte** (`/analytics`) — Personal LinkedIn account analytics: import your own posts via Apify scrape, view KPIs (total posts, avg likes, avg engagement, top format), LineChart (likes over time), BarChart (format breakdown), SVG heatmap (GitHub-style activity calendar), AI analysis via Claude Sonnet. Account linking/unlinking with safety confirmation modal.
5. **Onboarding** — 3-step form to collect creator profile (niche, tone, audience, goals, frequency, context). Skipped if profile already exists.
6. **Locked** — Password gate. Correct password sets an `app_access` cookie and redirects to onboarding.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| AI | Anthropic SDK — Haiku 4.5 (bulk/cheap), Sonnet 4.6 (quality) |
| Scraping | Apify actor `harvestapi/linkedin-profile-posts` |
| Charts | recharts (LineChart, BarChart) + native SVG heatmap |
| DnD | @dnd-kit/core + @dnd-kit/sortable |
| Date utils | date-fns |
| Icons | lucide-react |

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # service role, NOT anon key — no auth layer
ANTHROPIC_API_KEY=
APIFY_API_TOKEN=
APP_SECRET=                       # password for /locked page
```

**Important:** The app uses the service role key directly from server code. There is no Supabase Auth. RLS is disabled on all tables.

---

## Authentication

`middleware.ts` guards every route. Bypass list: `/locked`, `/api/unlock`, `/_next`, `/favicon.ico`.

The middleware checks `req.cookies.get("app_access")` against `process.env.APP_SECRET`. If it doesn't match, it redirects to `/locked`.

`POST /api/unlock` sets the cookie; `GET /app/locked` shows the password form.

---

## Database schema

All tables have RLS disabled. No `user_id` anywhere — this is a single-user app.

### `supabase/migrations/001_init.sql`
```sql
creators          id, name, linkedin_url (unique), category, avatar_url, follower_count, last_scraped_at, created_at
scraped_posts     id, creator_id (FK→creators), content, published_at, likes, comments, shares, engagement_rate, hook_type, format, themes (text[]), post_url, created_at
insights          id, best_hooks (jsonb), best_formats (jsonb), best_themes (jsonb), best_posting_times (jsonb), updated_at
generated_posts   id, content, hook, cta, subject, format, status ('draft'|'validated'|'scheduled'|'published'), scheduled_date (timestamptz), calendar_position, created_at
creator_profile   id, niche, tone, target_audience, goals (text[]), posting_frequency (int default 5), context, linkedin_url, updated_at
```

### `supabase/migrations/004_my_posts.sql`
```sql
my_posts          id, content, published_at, likes, comments, shares, views, engagement_rate, hook_type, format, themes (text[]), post_url, created_at
```
Also: `ALTER TABLE creator_profile ADD COLUMN IF NOT EXISTS linkedin_url text`

**`insights` and `creator_profile`** are single-row tables — no unique constraint, upsert is done manually (check-then-insert-or-update).

**`creators.category`** check: `'competitor' | 'top_creator' | 'influencer'`

**`apify_runs`** table: tracks Apify run costs — `run_id`, `posts_scraped`, `cost_usd`, `created_at`. Inserted fire-and-forget in `getScrapingResults`.

---

## Supabase client

Both `lib/supabase/server.ts` and `lib/supabase/client.ts` are identical and use the service role key:

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

---

## File structure

```
app/
  layout.tsx                     Root layout with Sidebar
  page.tsx                       Redirects to /inspirations
  locked/page.tsx                Password form
  onboarding/page.tsx            3-step profile setup
  inspirations/page.tsx          Creator tabs + cards grid (handleScrapeDone callback)
  create/page.tsx                Agent chat + generated posts (copy button)
  calendar/page.tsx              DnD calendar (week + month) (copy button in detail modal)
  analytics/page.tsx             Mon compte — personal post analytics + AI insights
  api/
    unlock/route.ts              POST: set app_access cookie
    profile/route.ts             GET + POST: creator_profile
    creators/route.ts            GET (with post_count) + POST
    creators/[id]/route.ts       DELETE
    creators/[id]/status/route.ts GET: {last_scraped_at, post_count, avatar_url}
    creators/[id]/scrape/route.ts POST: start async Apify run, returns {runId}
    creators/[id]/scrape-status/route.ts GET: poll run, insert posts+analysis when done
    posts/route.ts               GET with ?status= filter
    posts/[id]/route.ts          PATCH + DELETE
    agent/start/route.ts         GET: profile + insights for chat
    agent/generate/route.ts      POST: batch generate posts
    agent/regenerate/route.ts    POST: regenerate single post
    generate/route.ts            Legacy single-post generation
    my-posts/route.ts            GET: list my_posts; POST: add manual post
    my-posts/[id]/route.ts       DELETE
    my-posts/import/route.ts     POST: scrape user's LinkedIn + deduplicate + insert
    my-posts/analyze/route.ts    POST: Claude Sonnet AI analysis of my posts
    my-posts/unlink/route.ts     POST: delete all my_posts + set linkedin_url=null
    insights/refresh/route.ts    POST: trigger refreshInsights(), return updated data
    costs/route.ts               GET: aggregate Anthropic + Apify costs (force-dynamic)

components/
  layout/Sidebar.tsx             Nav sidebar (240px wide) — includes Mon compte link
  layout/CostDrawer.tsx          Sliding cost panel (no-cache fetch)
  inspirations/CreatorCard.tsx   Card with async polling + avatar (LocalState) + onScrapeDone
  inspirations/AddCreatorModal.tsx Category select + URL form

lib/
  supabase/server.ts             Supabase client (service role)
  supabase/client.ts             Same (both identical)
  apify.ts                       startScraping() / getScrapingResults() / scrapeLinkedInPosts()
  claude.ts                      analyzePost / generatePosts / regenerateSinglePost
  insights.ts                    refreshInsights() — .limit(1000) to avoid truncation
  utils.ts                       cn(), formatNumber(), timeAgo()

types/index.ts                   All shared TypeScript types
supabase/migrations/001_init.sql DB schema
supabase/migrations/004_my_posts.sql my_posts table + linkedin_url column
middleware.ts                    Cookie auth guard (excludes /api/ routes from caching)
next.config.js                   remotePatterns: licdn.com + linkedin.com/dms for avatars
```

---

## Key lib functions

### `lib/apify.ts`

Actor used: `harvestapi/linkedin-profile-posts`

| Function | Description |
|---|---|
| `scrapeLinkedInPosts(url)` | Sync scrape — blocks until done (120s max). Used by `/api/my-posts/import`. |
| `startScraping(url)` | Async — starts run, returns `runId`. Used by `/api/creators/[id]/scrape`. |
| `getScrapingResults(runId)` | Polls run status. Returns `ScrapingResult \| null` — null if still running. |

`ScrapingResult = { posts: ScrapedLinkedInPost[]; avatarUrl: string | null }`

`ScrapedLinkedInPost` fields: `content, publishedAt, likes, comments, shares, views, postUrl`

Field extraction helpers: `str()`, `num()`, `nestedNum()` (dot-path access e.g. `reactions.count`).

**Avatar extraction** uses `deepScanLinkedInUrl()` — recursively scans the entire Apify item structure (up to depth 6) for any string containing `licdn.com` or `linkedin.com/dms`. Priority keys are checked first: `profilePicture`, `authorImage`, `authorProfilePicture`, etc. This handles any actor field structure.

### `lib/claude.ts`

| Function | Model | Purpose |
|---|---|---|
| `analyzePost(content)` | Haiku 4.5 | Returns `{hook_type, format, themes[], engagement_prediction}`. Falls back to `ANALYSIS_FALLBACK` on JSON parse error. |
| `generatePosts(params)` | Sonnet 4.6 | Injects full creator profile + insights context. Returns `GeneratedPostData[]`. Throws on invalid JSON. |
| `regenerateSinglePost(params)` | Haiku 4.5 | Passes current content to "surpass". Returns single `GeneratedPostData`. |
| `generatePost(params)` | Sonnet 4.6 | Legacy — kept for `/api/generate`. |

Claude model IDs in use:
- Haiku: `claude-haiku-4-5-20251001`
- Sonnet: `claude-sonnet-4-6`

### `lib/insights.ts` — `refreshInsights()`

Reads all `scraped_posts.hook_type, format, themes` with `.limit(1000)` (Supabase default was truncating at ~100 rows) → computes top 5 hooks, top 5 formats, top 10 themes using frequency counting. Single-row upsert into `insights`.

---

## Scrape pipeline (async, two routes)

### `POST /api/creators/[id]/scrape`
Starts Apify run via `startScraping(linkedinUrl)`, immediately returns `{ runId }`. No waiting.

### `GET /api/creators/[id]/scrape-status?runId=xxx` (polled every 5s by CreatorCard)
1. Call `getScrapingResults(runId)` — returns null if still running
2. If done: fetch existing `post_url` set, filter new posts
3. `Promise.all(analyzePost)` on new posts (parallel Claude Haiku calls)
4. Batch insert to `scraped_posts` with `hook_type, format, themes`
5. Update `creators.last_scraped_at` and `avatar_url` if found
6. Update `apify_runs.posts_scraped` (fire-and-forget)
7. Call `refreshInsights()` non-blocking
8. Return `{ done: true, count: N }`

### CreatorCard polling pattern
- Click "Scraper" → POST `/scrape` → get `runId` → store in state
- `useEffect` on `runId` → `setInterval(5000)` polling `/scrape-status`
- When done: fetch `/api/creators/[id]/status` for fresh data → update `LocalState` (avatar, post count, last_scraped_at) → call `onScrapeDone(update)` → show toast
- Parent `handleScrapeDone` updates the creator object in the `creators` array + calls `refreshInsights`

---

## Calendar DnD

Uses `@dnd-kit/core` with:
- `MouseSensor` with `activationConstraint: { distance: 8 }` — prevents drag/click conflict
- `TouchSensor` with `delay: 250, tolerance: 5`
- `DragOverlay dropAnimation={null}` — renders `DragPreview`, original card goes `opacity-30`

`handleDragEnd` logic:
- `over.id === "unscheduled"` → set `scheduled_date = null` + status back to `validated`
- else → parse date from `over.id`, call `toUTC9(date)` (stores at 09:00 UTC+9), set status to `scheduled`

Week view: `UnscheduledColumn` (non-published posts without a date) + 7 `DayColumn` components.
Month view: `monthGrid` helper builds full weeks spanning the month; `DayCell` shows up to 3 post pills + "+N autres" overflow. Click a day to open a side panel.

---

## Create page — agent chat

Phase state machine: `"loading" → "chat" → "generating" → "posts"`

3 questions:
1. Topics/subjects (free text)
2. Tone (free text, with suggestions from insights)
3. Post count + format (parsed from free text with regex `\d+` for count, keyword match for format)

`parseQ3(text)` extracts both count and format from a single answer.

Between Q2 and Q3 there is a 600ms simulated typing delay.

On submit: POSTs to `/api/agent/generate`, inserts posts to DB with `status: 'draft'`, returns to posts view.

`PostCard` has an `AutoTextarea` that auto-resizes via `scrollHeight`. Validate button sets `status: 'validated'`. Regenerate calls `/api/agent/regenerate`.

Sticky bottom bar: `fixed bottom-0 left-60 right-0` (accounts for 240px sidebar). Calendar link is disabled (`pointer-events-none`) until at least one post is validated.

---

## Inspirations page

4 tabs: All / Competitor / Top Creator / Influencer — each shows filtered creator count.

`CreatorCard` has local state (`LocalState`) for `{ last_scraped_at, post_count, avatar_url }` — never stale because it doesn't depend on re-renders from the parent. Avatar uses `next/image` with `local.avatar_url`.

Category badge colors: competitor=red, top_creator=brand blue, influencer=purple.

`AddCreatorModal` has a category `<select>` with `ChevronDown` icon.

## Mon compte page (`/analytics`)

State machine:
- No `linkedin_url` in profile → empty state with "Lier mon compte" input
- Has `linkedin_url` → shows green linked banner + KPIs + charts + AI analysis

**Account linking**: POST to `/api/profile` with `{ linkedin_url }`, then auto-imports posts.

**Import** (`/api/my-posts/import`):
- Scrapes via `scrapeLinkedInPosts(linkedinUrl)` (sync, up to 120s)
- Auto-calculates `since` date from latest `my_posts.published_at` to avoid re-importing
- Deduplicates by `post_url` AND first 100 chars of content
- Returns `{ imported, skipped, total }`

**Unlink** flow: `UnlinkModal` requires user to type "CONFIRMER" → POST `/api/my-posts/unlink` deletes all `my_posts` + sets `creator_profile.linkedin_url = null`.

**AI analysis** (`/api/my-posts/analyze`): Claude Sonnet analyzes all posts, returns `{ best_day, best_format, best_hook, avg_engagement, insights[], recommendations[] }`.

**Charts**: recharts `LineChart` (likes over time, last 30 posts), `BarChart` with `Cell` colors (format breakdown). SVG heatmap is a native 52×7 grid (GitHub-style activity calendar). Recharts `Tooltip` formatter typed as plain function (no type annotation) to avoid `ValueType` build error.

---

## TypeScript types (`types/index.ts`)

Key field names (easy to confuse):
- `Creator.follower_count` — singular, integer (NOT `followers_count`)
- `GeneratedPost.scheduled_date` — timestamptz string or null (NOT `scheduled_at`)
- `CreatorProfile.posting_frequency` — integer (posts per week)

---

## API routes — quick reference

| Method | Route | What it does |
|---|---|---|
| GET | `/api/profile` | Fetch creator_profile (first row) |
| POST | `/api/profile` | Upsert creator_profile |
| GET | `/api/creators` | List creators with post_count |
| POST | `/api/creators` | Add creator |
| DELETE | `/api/creators/[id]` | Delete creator + cascade scraped_posts |
| GET | `/api/creators/[id]/status` | `{last_scraped_at, post_count, avatar_url}` |
| POST | `/api/creators/[id]/scrape` | Start async Apify run → `{runId}` |
| GET | `/api/creators/[id]/scrape-status?runId=` | Poll run, insert+analyze when done → `{done, count}` |
| GET | `/api/posts?status=draft,validated` | Posts filtered by comma-separated statuses |
| PATCH | `/api/posts/[id]` | Update any fields on a post |
| DELETE | `/api/posts/[id]` | Delete a post |
| GET | `/api/agent/start` | Load profile + insights for chat init |
| POST | `/api/agent/generate` | Batch generate posts from chat answers |
| POST | `/api/agent/regenerate` | Regenerate a single post |
| GET | `/api/my-posts` | List all my_posts |
| POST | `/api/my-posts` | Add manual post |
| DELETE | `/api/my-posts/[id]` | Delete a my_post |
| POST | `/api/my-posts/import` | Scrape + deduplicate + insert my_posts |
| POST | `/api/my-posts/analyze` | Claude Sonnet AI analysis → insights |
| POST | `/api/my-posts/unlink` | Delete all my_posts + clear linkedin_url |
| POST | `/api/insights/refresh` | Trigger refreshInsights(), return updated data |
| GET | `/api/costs` | Aggregate Anthropic + Apify cost totals |

`/api/posts` orders by `scheduled_date ASC nulls last`, then `created_at DESC`.

`/api/costs` uses `export const dynamic = 'force-dynamic'` + `Cache-Control: no-store` to prevent 304 caching issues.

---

## Patterns to follow

- **No auth checks in API routes** — middleware handles access. Routes just use service role client.
- **Single-row upsert**: check `select("id").limit(1).maybeSingle()`, then `update` or `insert`.
- **Optimistic updates in UI**: update local state immediately, then fire API call.
- **Fire-and-forget scraping**: no `await` in the response path for long operations; use background pattern or non-blocking call + client polling.
- **French UI**: all user-facing text and Claude prompts are in French (except the legacy `generatePost` function).
- **French dates without locale import**: `FR_MONTHS` and `FR_DAYS` are hardcoded arrays in calendar page to avoid importing the full date-fns French locale bundle.

---

## Known gotchas

- The Supabase client file at `lib/supabase/client.ts` and `lib/supabase/server.ts` are identical — both use the service role key, there is no browser client.
- `creator_profile` and `insights` have no unique constraint; the single-row upsert must manually check for an existing row.
- Apify scraping for creators is now **async** (start + poll pattern). `scrapeLinkedInPosts()` is still sync and used only by my-posts import.
- Supabase default query limit is ~100 rows — always add `.limit(1000)` or paginate when querying tables that can grow (e.g. `scraped_posts`, `my_posts`).
- The calendar `toUTC9` helper stores scheduled dates at 09:00 in UTC+9 (JST). If timezone handling changes, check this function first.
- Publish button in DnD cards uses `onPointerDown={(e) => e.stopPropagation()}` to prevent accidental drag start.
- recharts `Tooltip` `formatter` prop: do NOT add a TypeScript type annotation — `ValueType` is a union and the annotation breaks Vercel builds. Let TypeScript infer it from context.
- `next/image` requires `licdn.com` and `linkedin.com/dms` domains in `next.config.js` `remotePatterns` for avatar images to work.
- `CreatorCard` tracks `avatar_url`, `post_count`, and `last_scraped_at` in `LocalState` (not from props) so the UI updates reactively after scraping without a page reload.
- `/api/costs` must use `export const dynamic = 'force-dynamic'` + `Cache-Control: no-store` response headers — without these, Next.js/CDN returns 304 and the cost panel never updates.
