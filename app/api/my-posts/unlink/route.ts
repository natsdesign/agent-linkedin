import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createClient();

  // Delete all my_posts
  await supabase.from("my_posts").delete().lte("created_at", new Date().toISOString());

  // Clear linkedin_url in creator_profile
  const { data: profile } = await supabase
    .from("creator_profile")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (profile) {
    await supabase
      .from("creator_profile")
      .update({ linkedin_url: null })
      .eq("id", profile.id);
  }

  return NextResponse.json({ ok: true });
}
