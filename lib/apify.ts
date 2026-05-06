import { ApifyClient } from "apify-client";
import { createClient } from "@/lib/supabase/server";

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

export type ScrapedLinkedInPost = {
  content: string;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  postUrl: string | null;
};

// Defensive field extraction from Apify items (field names vary by actor version)
function str(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (v && typeof v === "string") return v;
  }
  return "";
}

function num(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && typeof v === "number") return v;
  }
  return 0;
}

function mapItems(items: Record<string, unknown>[]): ScrapedLinkedInPost[] {
  return items
    .map((item): ScrapedLinkedInPost => ({
      content:     str(item, "text", "content", "postText", "body"),
      publishedAt: str(item, "postedAt", "publishedAt", "date", "createdAt") || null,
      likes:    num(item, "likes",    "likeCount",    "numLikes",    "likesCount"),
      comments: num(item, "comments", "commentCount", "numComments", "commentsCount"),
      shares:   num(item, "shares",   "repostCount",  "shareCount",  "sharesCount", "numShares"),
      postUrl:  str(item, "url", "postUrl", "shareUrl", "link") || null,
    }))
    .filter((p) => p.content.trim().length > 0);
}

// Synchronous scrape — used by the daily cron (long-running server context)
export async function scrapeLinkedInPosts(
  linkedinUrl: string
): Promise<ScrapedLinkedInPost[]> {
  const run = await client.actor("harvestapi/linkedin-profile-posts").call(
    { targetUrls: [linkedinUrl], maxPosts: 30, includeQuotePosts: true, includeReposts: false, scrapeComments: false, scrapeReactions: false },
    { waitSecs: 120 }
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rawItems = items as Record<string, unknown>[];
  console.log('RAW APIFY ITEM:', JSON.stringify(rawItems[0], null, 2))
  return mapItems(rawItems);
}

// Async scrape — starts the Apify run and returns immediately
export async function startScraping(linkedinUrl: string): Promise<string> {
  const run = await client.actor("harvestapi/linkedin-profile-posts").start({
    targetUrls: [linkedinUrl],
    maxPosts: 30,
    includeQuotePosts: true,
    includeReposts: false,
    scrapeComments: false,
    scrapeReactions: false,
  });
  return run.id;
}

// Poll run status — returns posts when done, null if still running
export async function getScrapingResults(
  runId: string
): Promise<ScrapedLinkedInPost[] | null> {
  const run = await client.run(runId).get();
  if (!run) return null;
  console.log("Status du run:", run.status);
  if (run.status === "RUNNING" || run.status === "READY") return null;
  if (run.status !== "SUCCEEDED") return []; // FAILED / ABORTED / TIMED-OUT
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log("Items trouvés:", items.length);
  const mapped = mapItems(items as Record<string, unknown>[]);

  void (async () => {
    const { error } = await createClient()
      .from("apify_runs")
      .insert({ run_id: runId, posts_scraped: mapped.length, cost_usd: mapped.length * 0.002 });
    if (error) console.error("[apify_runs insert error]", error.message);
  })();

  return mapped;
}
