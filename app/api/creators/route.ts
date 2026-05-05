import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("creators")
    .select("*, scraped_posts(count)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const creators = (data ?? []).map(({ scraped_posts, ...c }) => ({
    ...c,
    post_count: (scraped_posts as { count: number }[])?.[0]?.count ?? 0,
  }));

  return NextResponse.json(creators);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const body = await req.json();
  const { name, linkedin_url, category } = body;

  if (!name || !linkedin_url) {
    return NextResponse.json({ error: "name et linkedin_url sont requis." }, { status: 400 });
  }

  const urlPattern = /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?/;
  if (!urlPattern.test(linkedin_url)) {
    return NextResponse.json({ error: "URL LinkedIn invalide." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("creators")
    .insert({ name, linkedin_url, category: category ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ce créateur est déjà dans la liste." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ...data, post_count: 0 }, { status: 201 });
}
