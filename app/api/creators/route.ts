import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export async function GET() {
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  const { data, error } = await supabase
    .from("creators")
    .select("*, scraped_posts(count)")
    .eq("account_id", accountId)
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
  const accountId = await getActiveAccountId();

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
    .insert({ name, linkedin_url, category: category ?? null, account_id: accountId })
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
