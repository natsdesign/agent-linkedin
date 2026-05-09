import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeLinkedInPosts } from "@/lib/apify";
import { analyzePost } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json().catch(() => ({}));

  // Get creator_profile for linkedin_url and current avatar
  const { data: profile } = await supabase
    .from("creator_profile")
    .select("id, linkedin_url, avatar_url")
    .limit(1)
    .maybeSingle();

  const linkedinUrl = profile?.linkedin_url;
  if (!linkedinUrl) {
    return NextResponse.json(
      { error: "Aucune URL LinkedIn dans ton profil. Renseigne-la d'abord." },
      { status: 400 }
    );
  }

  // Scrape (synchronous, up to 120s) — now returns { posts, avatarUrl }
  const { posts, avatarUrl } = await scrapeLinkedInPosts(linkedinUrl);
  console.log("MAPPED ITEM:", JSON.stringify(posts[0], null, 2));
  console.log("Avatar URL (my-posts):", avatarUrl);

  // Save avatar_url to creator_profile if not already set
  if (avatarUrl && profile?.id && !profile.avatar_url) {
    void supabase
      .from("creator_profile")
      .update({ avatar_url: avatarUrl })
      .eq("id", profile.id);
  }

  if (posts.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, total: 0 });
  }

  // Fetch existing posts for deduplication + since calculation
  const { data: existing } = await supabase
    .from("my_posts")
    .select("post_url, content, published_at")
    .order("published_at", { ascending: false });

  const existingUrls = new Set(
    (existing ?? []).map((p: { post_url: string | null }) => p.post_url).filter(Boolean)
  );
  const existingPrefixes = new Set(
    (existing ?? []).map((p: { content: string }) => p.content.slice(0, 100))
  );

  // since: from body or auto-calculated from last imported post date
  const since: string | null =
    body?.since ?? (existing as Array<{ published_at: string | null }> | null)?.[0]?.published_at ?? null;

  // Filter by date if since is available
  const datFiltered = since
    ? posts.filter((p) => p.publishedAt && p.publishedAt > since)
    : posts;

  const total = datFiltered.length;

  // Deduplicate by post_url OR first 100 chars of content
  const newPosts = datFiltered.filter((p) => {
    if (p.postUrl && existingUrls.has(p.postUrl)) return false;
    if (existingPrefixes.has(p.content.slice(0, 100))) return false;
    return true;
  });
  const skipped = total - newPosts.length;

  if (newPosts.length === 0) {
    return NextResponse.json({ imported: 0, skipped, total });
  }

  // Analyze with Claude Haiku
  const analyses = await Promise.all(
    newPosts.map((p) => analyzePost(p.content).catch(() => null))
  );

  const rows = newPosts.map((p, i) => {
    const a = analyses[i];
    const engagement_rate =
      p.views > 0
        ? ((p.likes + p.comments) / p.views) * 100
        : p.likes > 0
        ? p.likes / 100
        : 0;
    return {
      content:         p.content,
      published_at:    p.publishedAt,
      likes:           p.likes,
      comments:        p.comments,
      shares:          p.shares,
      views:           p.views,
      engagement_rate,
      hook_type:       a?.hook_type ?? null,
      format:          a?.format ?? null,
      themes:          a?.themes ?? [],
      post_url:        p.postUrl,
    };
  });

  await supabase.from("my_posts").insert(rows);
  return NextResponse.json({ imported: newPosts.length, skipped, total });
}
