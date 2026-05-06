import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeLinkedInPosts } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";

export async function POST() {
  const supabase = createClient();

  // Get linkedin_url from creator_profile
  const { data: profile } = await supabase
    .from("creator_profile")
    .select("linkedin_url")
    .limit(1)
    .maybeSingle();

  const linkedinUrl = profile?.linkedin_url;
  if (!linkedinUrl) {
    return NextResponse.json(
      { error: "Aucune URL LinkedIn dans ton profil. Renseigne-la d'abord." },
      { status: 400 }
    );
  }

  // Scrape (synchronous, up to 120s)
  const posts = await scrapeLinkedInPosts(linkedinUrl);
  if (posts.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  // Filter already imported urls
  const { data: existing } = await supabase.from("my_posts").select("post_url");
  const existingUrls = new Set(
    (existing ?? []).map((p: { post_url: string | null }) => p.post_url).filter(Boolean)
  );
  const newPosts = posts.filter((p) => !p.postUrl || !existingUrls.has(p.postUrl));

  if (newPosts.length === 0) return NextResponse.json({ count: 0 });

  // Analyze with Claude Haiku
  const analyses = await Promise.all(
    newPosts.map((p) => analyzePost(p.content).catch(() => null))
  );

  const rows = newPosts.map((p, i) => {
    const a = analyses[i];
    const views = 0;
    const engagement_rate =
      views > 0 ? ((p.likes + p.comments) / views) * 100 : null;
    return {
      content:         p.content,
      published_at:    p.publishedAt,
      likes:           p.likes,
      comments:        p.comments,
      shares:          p.shares,
      views,
      engagement_rate,
      hook_type:       a?.hook_type ?? null,
      format:          a?.format ?? null,
      themes:          a?.themes ?? [],
      post_url:        p.postUrl,
    };
  });

  await supabase.from("my_posts").insert(rows);
  return NextResponse.json({ count: newPosts.length });
}
