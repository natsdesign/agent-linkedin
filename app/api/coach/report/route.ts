import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  const { data: report } = await supabase
    .from("coach_reports")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ report: null, predictions: [], history: [] });
  }

  const { data: predictions } = await supabase
    .from("coach_predictions")
    .select("*")
    .eq("week_start", report.week_start)
    .order("created_at", { ascending: true });

  const { data: history } = await supabase
    .from("coach_reports")
    .select("id, week_start, analysis, recommendations, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({
    report,
    predictions: predictions ?? [],
    history: history ?? [],
  });
}
