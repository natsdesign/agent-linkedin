import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prediction_id, knowledge_id, feedback, context } = body as {
    prediction_id?: string;
    knowledge_id?: string;
    feedback: "worked" | "didnt_work" | "neutral";
    context?: string;
  };

  const supabase = createClient();

  if (prediction_id) {
    const wasCorrect = feedback === "worked";
    await supabase
      .from("coach_predictions")
      .update({ was_correct: wasCorrect })
      .eq("id", prediction_id);
  }

  if (knowledge_id) {
    await supabase.from("coach_feedback").insert({ knowledge_id, feedback, context });

    const delta = feedback === "worked" ? 0.05 : feedback === "didnt_work" ? -0.1 : 0;
    if (delta !== 0) {
      const { data: k } = await supabase
        .from("coach_knowledge")
        .select("confidence_score")
        .eq("id", knowledge_id)
        .single();
      if (k) {
        const newScore = Math.min(0.99, Math.max(0.1, (k.confidence_score as number) + delta));
        await supabase
          .from("coach_knowledge")
          .update({ confidence_score: newScore, updated_at: new Date().toISOString() })
          .eq("id", knowledge_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
