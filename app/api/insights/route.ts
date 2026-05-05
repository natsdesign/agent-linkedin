import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("insights")
    .select("*")
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}
