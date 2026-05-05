import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeLinkedInPosts } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";
import { refreshInsights } from "@/lib/insights";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createClient();

  // 1. Fetch creator
  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .select("id, linkedin_url")
    .eq("id", params.id)
    .single();

  if (creatorError || !creator) {
    return NextResponse.json({ error: "Créateur introuvable." }, { status: 404 });
  }

  // 2. Scrape LinkedIn via Apify
  let scrapedPosts;
  try {
    scrapedPosts = await scrapeLinkedInPosts(creator.linkedin_url);
  } catch (err) {
    return NextResponse.json(
      { error: `Échec du scraping : ${err instanceof Error ? err.message : "erreur inconnue"}` },
      { status: 502 }
    );
  }

  if (scrapedPosts.length === 0) {
    return NextResponse.json({ scraped: 0, analyzed: 0 });
  }

  // 3. Skip posts already in DB (by post_url when available)
  const { data: existing } = await supabase
    .from("scraped_posts")
    .select("post_url")
    .eq("creator_id", params.id);

  const existingUrls = new Set(
    (existing ?? []).map((p) => p.post_url).filter(Boolean)
  );

  const newPosts = scrapedPosts.filter(
    (p) => !p.postUrl || !existingUrls.has(p.postUrl)
  );

  if (newPosts.length === 0) {
    // Still update last_scraped_at so the card reflects the check
    await supabase
      .from("creators")
      .update({ last_scraped_at: new Date().toISOString() })
      .eq("id", params.id);

    return NextResponse.json({ scraped: 0, analyzed: 0 });
  }

  // 4. Analyze each new post with Claude Haiku (parallel)
  const analyses = await Promise.all(
    newPosts.map((p) => analyzePost(p.content).catch(() => null))
  );

  const analyzed = analyses.filter(Boolean).length;

  // 5. Batch insert into scraped_posts
  const rows = newPosts.map((p, i) => {
    const a = analyses[i];
    return {
      creator_id: params.id,
      content: p.content,
      published_at: p.publishedAt,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      post_url: p.postUrl,
      hook_type: a?.hook_type ?? null,
      format: a?.format ?? null,
      themes: a?.themes ?? [],
    };
  });

  const { error: insertError } = await supabase
    .from("scraped_posts")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 6. Update creator's last_scraped_at
  await supabase
    .from("creators")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", params.id);

  // 7. Refresh global insights (non-blocking — we don't fail if this errors)
  await refreshInsights().catch((err) =>
    console.error("refreshInsights failed:", err)
  );

  return NextResponse.json({ scraped: newPosts.length, analyzed });
}
