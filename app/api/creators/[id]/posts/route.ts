import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const supabase = createClient();
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("scraped_posts")
    .select("id, content, published_at, likes, comments, hook_type, format, post_url", { count: "exact" })
    .eq("creator_id", params.id)
    .order("likes", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ posts: data ?? [], total: count ?? 0, page, limit });
}
