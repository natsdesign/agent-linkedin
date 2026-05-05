import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data } = await supabase
    .from("cron_logs")
    .select("*")
    .order("ran_at", { ascending: false })
    .limit(5);
  return NextResponse.json(data ?? []);
}
