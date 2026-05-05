import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeLinkedInPosts } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";
import { refreshInsights } from "@/lib/insights";

// Allow up to 300s on Vercel Pro for sequential scraping
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient();

  // Creators never scraped or last scraped > 23h ago
  const threshold = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: creators, error: creatorsError } = await supabase
    .from("creators")
    .select("id, linkedin_url, name")
    .or(`last_scraped_at.is.null,last_scraped_at.lt.${threshold}`);

  if (creatorsError) {
    return NextResponse.json({ error: "Failed to fetch creators" }, { status: 500 });
  }

  const due = creators ?? [];

  if (due.length === 0) {
    await supabase.from("cron_logs").insert({ creators_scraped: 0, posts_added: 0, errors: [] });
    return NextResponse.json({ success: true, summary: { creators_scraped: 0, posts_added: 0 } });
  }

  let totalPostsAdded = 0;
  let creatorsScraped = 0;
  const errors: { creator_id: string; name: string; error: string }[] = [];

  for (const creator of due) {
    try {
      const scrapedPosts = await scrapeLinkedInPosts(creator.linkedin_url);

      // Log Apify run
      void supabase.from("apify_runs").insert({
        creator_id:    creator.id,
        run_id:        `cron-${Date.now()}-${creator.id}`,
        posts_scraped: scrapedPosts.length,
        cost_usd:      0.002,
      });

      if (scrapedPosts.length === 0) {
        await supabase
          .from("creators")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", creator.id);
        creatorsScraped++;
        continue;
      }

      // Filter posts already in DB
      const { data: existing } = await supabase
        .from("scraped_posts")
        .select("post_url")
        .eq("creator_id", creator.id);

      const existingUrls = new Set(
        (existing ?? []).map((p: { post_url: string | null }) => p.post_url).filter(Boolean)
      );

      const newPosts = scrapedPosts.filter(
        (p) => !p.postUrl || !existingUrls.has(p.postUrl)
      );

      if (newPosts.length > 0) {
        // Analyze with Claude Haiku (parallel — usage logged inside analyzePost)
        const analyses = await Promise.all(
          newPosts.map((p) => analyzePost(p.content).catch(() => null))
        );

        const rows = newPosts.map((p, i) => {
          const a = analyses[i];
          return {
            creator_id:   creator.id,
            content:      p.content,
            published_at: p.publishedAt,
            likes:        p.likes,
            comments:     p.comments,
            shares:       p.shares,
            post_url:     p.postUrl,
            hook_type:    a?.hook_type ?? null,
            format:       a?.format ?? null,
            themes:       a?.themes ?? [],
          };
        });

        await supabase.from("scraped_posts").insert(rows);
        totalPostsAdded += newPosts.length;
      }

      await supabase
        .from("creators")
        .update({ last_scraped_at: new Date().toISOString() })
        .eq("id", creator.id);

      creatorsScraped++;
    } catch (err) {
      errors.push({
        creator_id: creator.id,
        name:       creator.name,
        error:      err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Refresh insights once after all scrapes
  if (totalPostsAdded > 0) {
    await refreshInsights().catch(console.error);
  }

  await supabase.from("cron_logs").insert({
    creators_scraped: creatorsScraped,
    posts_added:      totalPostsAdded,
    errors,
  });

  return NextResponse.json({
    success: true,
    summary: { creators_scraped: creatorsScraped, posts_added: totalPostsAdded },
  });
}
