import { NextRequest, NextResponse } from "next/server";
import { seedCoachKnowledge } from "@/lib/coach-knowledge-seed";

export async function POST(request: Request) {
  // Middleware already guards the route, but explicit cookie check for safety
  const cookieHeader = (request as NextRequest).cookies?.get("app_access")?.value;
  if (!cookieHeader || cookieHeader !== process.env.APP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedCoachKnowledge();
    return NextResponse.json({ success: true, inserted: result.seeded, message: result.message });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
