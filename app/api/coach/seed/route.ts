import { NextResponse } from "next/server";
import { seedCoachKnowledge } from "@/lib/coach-knowledge-seed";

export async function POST() {
  try {
    const result = await seedCoachKnowledge();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Seed failed" },
      { status: 500 }
    );
  }
}
