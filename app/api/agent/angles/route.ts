import { NextRequest, NextResponse } from "next/server";
import { anthropic } from "@/lib/claude";
import { guardedClaudeCall } from "@/lib/budget-guard";
import { createClient } from "@/lib/supabase/server";

const HAIKU = "claude-haiku-4-5-20251001";

function calcCost(input: number, output: number) {
  return (input * 0.80 + output * 4.00) / 1_000_000;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { context } = await req.json() as { context: string };

  if (!context?.trim()) {
    return NextResponse.json({ error: "context est requis." }, { status: 400 });
  }

  let message;
  try {
    message = await guardedClaudeCall(() =>
      anthropic.messages.create({
        model: HAIKU,
        max_tokens: 300,
        system: `Tu es un stratège contenu LinkedIn. À partir d'un contexte personnel, génère exactement 4 angles de posts différents.
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown :
[{"type":"storytelling"|"liste"|"opinion"|"question","emoji":"string","titre":"string","description":"string","hook_preview":"string"}]
- type : l'un des 4 types exactement
- emoji : 1 emoji pertinent
- titre : 5-8 mots percutants
- description : 1 phrase expliquant l'angle (max 80 car.)
- hook_preview : première ligne du post (accroche, max 100 car.)`,
        messages: [
          {
            role: "user",
            content: `Contexte : ${context.slice(0, 800)}

Génère 4 angles variés (1 de chaque type : storytelling, liste, opinion, question) pour transformer ce contexte en posts LinkedIn.`,
          },
        ],
      })
    );
  } catch (err) {
    if (err instanceof Error && err.message === "BUDGET_EXCEEDED") {
      return NextResponse.json(
        { error: "budget_exceeded", message: "Budget mensuel atteint (10€)." },
        { status: 402 }
      );
    }
    throw err;
  }

  const { input_tokens, output_tokens } = message.usage;
  void supabase.from("usage_logs").insert({
    action: "angles",
    model: HAIKU,
    input_tokens,
    output_tokens,
    cost_usd: calcCost(input_tokens, output_tokens),
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return NextResponse.json(parsed.slice(0, 4));
  } catch {
    return NextResponse.json({ error: "Réponse invalide de Claude." }, { status: 500 });
  }
}
