import { ApifyClient } from "apify-client";

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

export async function scrapeLinkedInPosts(
  linkedinUrl: string
): Promise<ScrapedLinkedInPost[]> {
  const run = await client.actor("apify/linkedin-post-scraper").call(
    {
      profileUrls: [linkedinUrl],
      maxPosts: 30,
    },
    { waitSecs: 120 }
  );

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return (items as Record<string, unknown>[])
    .map((item): ScrapedLinkedInPost => ({
      content: str(item, "text", "content", "postText", "body"),
      publishedAt: str(item, "publishedAt", "postedAt", "date", "createdAt") || null,
      likes:    num(item, "likeCount",    "numLikes",    "likes",    "likesCount"),
      comments: num(item, "commentCount", "numComments", "comments", "commentsCount"),
      shares:   num(item, "repostCount",  "shareCount",  "shares",   "sharesCount", "numShares"),
      postUrl:  str(item, "url", "shareUrl", "postUrl", "link") || null,
    }))
    .filter((p) => p.content.trim().length > 0);
}
