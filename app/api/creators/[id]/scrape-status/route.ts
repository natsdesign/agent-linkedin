import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScrapingResults } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";
import { refreshInsights } from "@/lib/insights";
import { getActiveAccountId } from "@/lib/account-context";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId manquant" }, { status: 400 });
  }

  let result;
  try {
    result = await getScrapingResults(runId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Apify" },
      { status: 502 }
    );
  }

  // Still running
  if (result === null) {
    return NextResponse.json({ done: false });
  }

  const { posts: scrapedPosts, avatarUrl } = result;
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  // Run finished but no posts (failed/aborted/empty)
  if (scrapedPosts.length === 0) {
    await supabase
      .from("creators")
      .update({
        last_scraped_at: new Date().toISOString(),
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      })
      .eq("id", params.id);
    return NextResponse.json({ done: true, count: 0 });
  }

  // Filter posts already in DB
  const { data: existing } = await supabase
    .from("scraped_posts")
    .select("post_url")
    .eq("creator_id", params.id)
    .eq("account_id", accountId);

  const existingUrls = new Set(
    (existing ?? []).map((p: { post_url: string | null }) => p.post_url).filter(Boolean)
  );

  const newPosts = scrapedPosts.filter(
    (p) => !p.postUrl || !existingUrls.has(p.postUrl)
  );

  // Update creator regardless
  await supabase
    .from("creators")
    .update({
      last_scraped_at: new Date().toISOString(),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    .eq("id", params.id);

  if (newPosts.length === 0) {
    return NextResponse.json({ done: true, count: 0 });
  }

  // ── Fast path: insert raw posts immediately (no Claude) ──────────────────────
  // Claude analysis happens in background to avoid Vercel timeout

  const rows = newPosts.map((p) => ({
    creator_id:   params.id,
    account_id:   accountId,
    content:      p.content,
    published_at: p.publishedAt,
    likes:        p.likes,
    comments:     p.comments,
    shares:       p.shares,
    post_url:     p.postUrl,
    hook_type:    null,
    format:       null,
    themes:       [],
  }));

  const { data: inserted } = await supabase
    .from("scraped_posts")
    .insert(rows)
    .select("id, content");

  // Update apify run cost (fire-and-forget)
  void supabase
    .from("apify_runs")
    .update({ posts_scraped: newPosts.length })
    .eq("run_id", runId);

  // ── Background: analyze + update + refresh insights ──────────────────────────
  // Intentionally not awaited — runs after response is sent
  void (async () => {
    if (!inserted || inserted.length === 0) return;
    try {
      await Promise.all(
        inserted.map(async (row) => {
          try {
            const analysis = await analyzePost(row.content);
            await supabase
              .from("scraped_posts")
              .update({
                hook_type: analysis.hook_type,
                format:    analysis.format,
                themes:    analysis.themes,
              })
              .eq("id", row.id);
          } catch {
            // individual analysis failure is non-critical
          }
        })
      );
    } catch {
      // ignore
    }
    refreshInsights().catch(() => {});
  })();

  return NextResponse.json({ done: true, count: newPosts.length });
}
