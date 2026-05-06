import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshInsights } from "@/lib/insights";

export async function POST() {
  await refreshInsights();

  const supabase = createClient();
  const { data: posts } = await supabase
    .from("scraped_posts")
    .select("id", { count: "exact", head: true });

  const { data: insights } = await supabase
    .from("insights")
    .select("*")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ ok: true, insights });
}
