import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const accountsWithStats = await Promise.all(
    (accounts ?? []).map(async (account) => {
      const [{ count: creatorsCount }, { count: generatedPostsCount }, { count: myPostsCount }] =
        await Promise.all([
          supabase
            .from("creators")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id),
          supabase
            .from("generated_posts")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id),
          supabase
            .from("my_posts")
            .select("*", { count: "exact", head: true })
            .eq("account_id", account.id),
        ]);
      return {
        ...account,
        stats: {
          creators: creatorsCount ?? 0,
          generated_posts: generatedPostsCount ?? 0,
          my_posts: myPostsCount ?? 0,
        },
      };
    })
  );

  return NextResponse.json(accountsWithStats);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name: body.name,
      type: body.type ?? "personal",
      avatar_url: body.avatar_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
