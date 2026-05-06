import { ApifyClient } from "apify-client";
import { createClient } from "@/lib/supabase/server";

const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

export type ScrapedLinkedInPost = {
  content: string;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  views: number;
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

// Extracts a number from a nested path like "reactions.count"
function nestedNum(obj: Record<string, unknown>, path: string): number {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return 0;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : 0;
}

// Extract the author's profile picture from the first raw item
function extractAvatarUrl(item: Record<string, unknown>): string | null {
  // Try direct top-level fields
  for (const k of ["authorProfilePicture", "authorImage", "actorImage", "profilePicture", "authorAvatar", "profileImage"]) {
    const v = item[k];
    if (typeof v === "string" && v.startsWith("http")) return v;
  }
  // Try nested author / actor objects
  for (const parentKey of ["author", "actor"]) {
    const parent = item[parentKey];
    if (parent && typeof parent === "object") {
      const obj = parent as Record<string, unknown>;
      for (const k of ["profilePicture", "image", "avatar", "picture", "photo", "profileImage"]) {
        const v = obj[k];
        if (typeof v === "string" && v.startsWith("http")) return v;
      }
    }
  }
  return null;
}

function mapItems(items: Record<string, unknown>[]): ScrapedLinkedInPost[] {
  return items
    .map((item): ScrapedLinkedInPost => ({
      content:     str(item, "text", "content", "postText", "body"),
      publishedAt: str(item, "postedAt", "publishedAt", "date", "createdAt") || null,
      likes:    num(item, "likeCount", "likesCount", "numLikes", "likes") || nestedNum(item, "reactions.count"),
      comments: num(item, "commentCount", "commentsCount", "numComments", "comments"),
      shares:   num(item, "repostCount", "shareCount", "sharesCount", "numShares", "shares"),
      views:    num(item, "viewCount", "impressionCount", "numImpressions", "views"),
      postUrl:  str(item, "url", "postUrl", "shareUrl", "link") || null,
    }))
    .filter((p) => p.content.trim().length > 0);
}

// Synchronous scrape — used by my-posts/import (long-running server context)
export async function scrapeLinkedInPosts(
  linkedinUrl: string
): Promise<ScrapedLinkedInPost[]> {
  const run = await client.actor("harvestapi/linkedin-profile-posts").call(
    { targetUrls: [linkedinUrl], maxPosts: 30, includeQuotePosts: true, includeReposts: false, scrapeComments: false, scrapeReactions: false },
    { waitSecs: 120 }
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  const rawItems = items as Record<string, unknown>[];
  console.log('RAW APIFY ITEM:', JSON.stringify(rawItems[0], null, 2));
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

export type ScrapingResult = {
  posts: ScrapedLinkedInPost[];
  avatarUrl: string | null;
};

// Poll run status — returns { posts, avatarUrl } when done, null if still running
export async function getScrapingResults(
  runId: string
): Promise<ScrapingResult | null> {
  const run = await client.run(runId).get();
  if (!run) return null;
  console.log("Status du run:", run.status);
  if (run.status === "RUNNING" || run.status === "READY") return null;
  if (run.status !== "SUCCEEDED") return { posts: [], avatarUrl: null };
  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log("Items trouvés:", items.length);
  const rawItems = items as Record<string, unknown>[];
  const posts = mapItems(rawItems);
  const avatarUrl = rawItems.length > 0 ? extractAvatarUrl(rawItems[0]) : null;
  console.log("Avatar URL trouvée:", avatarUrl);

  void (async () => {
    const { error } = await createClient()
      .from("apify_runs")
      .insert({ run_id: runId, posts_scraped: posts.length, cost_usd: posts.length * 0.002 });
    if (error) console.error("[apify_runs insert error]", error.message);
  })();

  return { posts, avatarUrl };
}
