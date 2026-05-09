import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const { data } = await supabase
    .from("coach_knowledge")
    .select("id, category, content, source, confidence_score, validated, created_at")
    .order("confidence_score", { ascending: false })
    .limit(10);

  return NextResponse.json(data ?? []);
}
