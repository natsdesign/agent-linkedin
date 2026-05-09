import { NextRequest, NextResponse } from "next/server";
import {
  detectPatternsFromData,
  generateWeeklyReport,
  updatePredictions,
} from "@/lib/coach";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await detectPatternsFromData();
    await updatePredictions();
    const report = await generateWeeklyReport();

    return NextResponse.json({ success: true, report_id: report.id, week_start: report.week_start });
  } catch (err) {
    console.error("[weekly-coach cron error]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Coach cron failed" },
      { status: 500 }
    );
  }
}
