import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("my_posts")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();

  const { content, published_at, likes, comments, shares, views, post_url } = body;
  if (!content) return NextResponse.json({ error: "Contenu requis" }, { status: 400 });

  const views_val = views ?? 0;
  const engagement_rate =
    views_val > 0
      ? Number((((likes ?? 0) + (comments ?? 0)) / views_val) * 100).toFixed(3)
      : null;

  const { data, error } = await supabase
    .from("my_posts")
    .insert({
      content,
      published_at: published_at || null,
      likes: likes ?? 0,
      comments: comments ?? 0,
      shares: shares ?? 0,
      views: views_val,
      engagement_rate: engagement_rate ? parseFloat(engagement_rate) : null,
      post_url: post_url || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
