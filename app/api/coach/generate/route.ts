import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateWeeklyReport } from "@/lib/coach";

export const maxDuration = 120;

export async function POST() {
  try {
    const report = await generateWeeklyReport();

    const supabase = createClient();
    const { data: predictions } = await supabase
      .from("coach_predictions")
      .select("*")
      .eq("week_start", report.week_start)
      .order("created_at", { ascending: true });

    return NextResponse.json({ report, predictions: predictions ?? [] });
  } catch (err) {
    console.error("[coach/generate error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
