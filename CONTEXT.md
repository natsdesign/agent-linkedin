# content-agent — Context for Claude Code

This file gives a complete picture of the project so you can pick up any task without reading all the source files first.

---

## What the app does

**content-agent** is a mono-user Next.js 14 web app for LinkedIn content creation:

1. **Inspirations** — Add LinkedIn creators (competitors, top creators, influencers), scrape their last 30 posts via Apify, analyze each post with Claude Haiku, and aggregate engagement insights.
2. **Create** — A 3-question agent chat (topics → tone → count/format) calls Claude Sonnet to batch-generate posts injected with the user's profile and scraped insights.
3. **Calendar** — Drag-and-drop (dnd-kit) week/month view to schedule, edit, validate, publish, and delete posts.
4. **Onboarding** — 3-step form to collect creator profile (niche, tone, audience, goals, frequency, context). Skipped if profile already exists.
5. **Locked** — Password gate. Correct password sets an `app_access` cookie and redirects to onboarding.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| AI | Anthropic SDK — Haiku 4.5 (bulk/cheap), Sonnet 4.6 (quality) |
| Scraping | Apify actor `apify/linkedin-post-scraper` |
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

## Database schema (`supabase/migrations/001_init.sql`)

All tables have RLS disabled. No `user_id` anywhere — this is a single-user app.

```sql
creators          id, name, linkedin_url (unique), category, avatar_url, follower_count, last_scraped_at, created_at
scraped_posts     id, creator_id (FK→creators), content, published_at, likes, comments, shares, engagement_rate, hook_type, format, themes (text[]), post_url, created_at
insights          id, best_hooks (jsonb), best_formats (jsonb), best_themes (jsonb), best_posting_times (jsonb), updated_at
generated_posts   id, content, hook, cta, subject, format, status ('draft'|'validated'|'scheduled'|'published'), scheduled_date (timestamptz), calendar_position, created_at
creator_profile   id, niche, tone, target_audience, goals (text[]), posting_frequency (int default 5), context, updated_at
```

**`insights` and `creator_profile`** are single-row tables — no unique constraint, upsert is done manually (check-then-insert-or-update).

**`creators.category`** check: `'competitor' | 'top_creator' | 'influencer'`

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
  inspirations/page.tsx          Creator tabs + cards grid
  create/page.tsx                Agent chat + generated posts
  calendar/page.tsx              DnD calendar (week + month)
  api/
    unlock/route.ts              POST: set app_access cookie
    profile/route.ts             GET + POST: creator_profile
    creators/route.ts            GET (with post_count) + POST
    creators/[id]/route.ts       DELETE
    creators/[id]/status/route.ts GET: {last_scraped_at, post_count}
    creators/[id]/scrape/route.ts POST: 7-step scrape pipeline
    posts/route.ts               GET with ?status= filter
    posts/[id]/route.ts          PATCH + DELETE
    agent/start/route.ts         GET: profile + insights for chat
    agent/generate/route.ts      POST: batch generate posts
    agent/regenerate/route.ts    POST: regenerate single post
    generate/route.ts            Legacy single-post generation

components/
  layout/Sidebar.tsx             Nav sidebar (240px wide)
  inspirations/CreatorCard.tsx   Card with polling + scrape trigger
  inspirations/AddCreatorModal.tsx Category select + URL form

lib/
  supabase/server.ts             Supabase client (service role)
  supabase/client.ts             Same (both identical)
  apify.ts                       scrapeLinkedInPosts()
  claude.ts                      analyzePost / generatePosts / regenerateSinglePost
  insights.ts                    refreshInsights()
  utils.ts                       cn() classnames helper

types/index.ts                   All shared TypeScript types
supabase/migrations/001_init.sql DB schema
middleware.ts                    Cookie auth guard
```

---

## Key lib functions

### `lib/apify.ts` — `scrapeLinkedInPosts(linkedinUrl)`

Calls `apify/linkedin-post-scraper` with `maxPosts: 30, waitSecs: 120`. Uses defensive multi-key extraction (`str()` and `num()` helpers) since Apify field names vary by actor version.

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

Reads all `scraped_posts.hook_type, format, themes` → computes top 5 hooks, top 5 formats, top 10 themes using frequency counting. Single-row upsert into `insights`.

---

## Scrape pipeline (`/api/creators/[id]/scrape`)

7 steps:
1. Fetch creator from DB
2. Scrape via Apify (sync, up to 120s)
3. Fetch existing `post_url` set from DB
4. Filter out already-scraped posts
5. `Promise.all(analyzePost)` on all new posts (parallel Claude calls)
6. Batch insert to `scraped_posts`
7. Update `creators.last_scraped_at`; call `refreshInsights()` non-blocking (no await)

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

`CreatorCard` polling pattern:
- Fire scrape: `fetch(...)` fire-and-forget, set `scraping: true`
- `useRef(last_scraped_at)` captures the value at scrape start
- `useEffect` + `setInterval(5000)` polls `/api/creators/[id]/status`
- Stops when `last_scraped_at` changes from the captured ref value

Category badge colors: competitor=red, top_creator=brand blue, influencer=purple.

`AddCreatorModal` has a category `<select>` with `ChevronDown` icon.

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
| GET | `/api/creators/[id]/status` | `{last_scraped_at, post_count}` for polling |
| POST | `/api/creators/[id]/scrape` | Run scrape pipeline |
| GET | `/api/posts?status=draft,validated` | Posts filtered by comma-separated statuses |
| PATCH | `/api/posts/[id]` | Update any fields on a post |
| DELETE | `/api/posts/[id]` | Delete a post |
| GET | `/api/agent/start` | Load profile + insights for chat init |
| POST | `/api/agent/generate` | Batch generate posts from chat answers |
| POST | `/api/agent/regenerate` | Regenerate a single post |

`/api/posts` orders by `scheduled_date ASC nulls last`, then `created_at DESC`.

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
- Apify runs synchronously (the `.call()` blocks until complete) — the scrape route can take up to 120 seconds. The frontend fires it as fire-and-forget and polls for completion.
- The calendar `toUTC9` helper stores scheduled dates at 09:00 in UTC+9 (JST). If timezone handling changes, check this function first.
- Publish button in DnD cards uses `onPointerDown={(e) => e.stopPropagation()}` to prevent accidental drag start.
