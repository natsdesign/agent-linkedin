import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient();

  const [creatorRes, countRes] = await Promise.all([
    supabase
      .from("creators")
      .select("last_scraped_at, avatar_url")
      .eq("id", params.id)
      .single(),
    supabase
      .from("scraped_posts")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", params.id),
  ]);

  if (creatorRes.error) {
    return NextResponse.json({ error: creatorRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    last_scraped_at: creatorRes.data?.last_scraped_at ?? null,
    avatar_url:      creatorRes.data?.avatar_url ?? null,
    post_count:      countRes.count ?? 0,
    is_scraping:     false,
  });
}
