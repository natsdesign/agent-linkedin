import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScrapingResults } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";
import { refreshInsights } from "@/lib/insights";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId manquant" }, { status: 400 });
  }

  let scrapedPosts;
  try {
    scrapedPosts = await getScrapingResults(runId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Apify" },
      { status: 502 }
    );
  }

  // Still running
  if (scrapedPosts === null) {
    return NextResponse.json({ done: false });
  }

  const supabase = createClient();

  // Run finished but no posts (failed/aborted/empty)
  if (scrapedPosts.length === 0) {
    await supabase
      .from("creators")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", params.id);
    return NextResponse.json({ done: true, count: 0 });
  }

  // Filter posts already in DB
  const { data: existing } = await supabase
    .from("scraped_posts")
    .select("post_url")
    .eq("creator_id", params.id);

  const existingUrls = new Set(
    (existing ?? []).map((p: { post_url: string | null }) => p.post_url).filter(Boolean)
  );

  const newPosts = scrapedPosts.filter(
    (p) => !p.postUrl || !existingUrls.has(p.postUrl)
  );

  if (newPosts.length === 0) {
    await supabase
      .from("creators")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", params.id);
    return NextResponse.json({ done: true, count: 0 });
  }

  // Analyze with Claude Haiku (parallel — usage logged inside analyzePost)
  const analyses = await Promise.all(
    newPosts.map((p) => analyzePost(p.content).catch(() => null))
  );

  // Batch insert
  const rows = newPosts.map((p, i) => {
    const a = analyses[i];
    return {
      creator_id:   params.id,
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

  await supabase
    .from("creators")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", params.id);

  // Update apify run with actual posts count (fire and forget)
  supabase
    .from("apify_runs")
    .update({ posts_scraped: newPosts.length })
    .eq("run_id", runId)
    .then(() => {}).catch(() => {});

  // Non-blocking insights refresh
  refreshInsights().catch(console.error);

  return NextResponse.json({ done: true, count: newPosts.length });
}
