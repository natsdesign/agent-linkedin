import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");

  let query = supabase
    .from("generated_posts")
    .select("*")
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (statusParam) {
    const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
