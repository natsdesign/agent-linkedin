import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";
import { guardedClaudeCall } from "@/lib/budget-guard";

const SONNET = "claude-sonnet-4-6";

function calcCost(input: number, output: number) {
  return (input * 3.0 + output * 15.0) / 1_000_000;
}

export async function POST() {
  const supabase = createClient();

  const { data: posts } = await supabase
    .from("my_posts")
    .select("content, published_at, likes, comments, views, format, hook_type, engagement_rate")
    .order("published_at", { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) {
    return NextResponse.json({ error: "Aucun post à analyser." }, { status: 400 });
  }

  const postsText = posts
    .map(
      (p, i) =>
        `Post ${i + 1} (${p.published_at?.slice(0, 10) ?? "?"}): ${p.content.slice(0, 300)}
Likes: ${p.likes} | Commentaires: ${p.comments} | Format: ${p.format ?? "?"} | Hook: ${p.hook_type ?? "?"} | Engagement: ${p.engagement_rate ?? "?"}%`
    )
    .join("\n\n");

  let message;
  try {
    message = await guardedClaudeCall(() => anthropic.messages.create({
      model: SONNET,
      max_tokens: 1000,
    system: `Tu es un expert en marketing LinkedIn. Analyse les performances des posts fournis et retourne UNIQUEMENT un objet JSON valide, sans markdown ni explication.`,
    messages: [
      {
        role: "user",
        content: `Voici mes ${posts.length} derniers posts LinkedIn avec leurs métriques :

${postsText}

Retourne un JSON avec cette structure exacte :
{
  "best_day": "string",
  "best_format": "string",
  "best_hook": "string",
  "avg_engagement": number,
  "insights": ["string","string","string"],
  "recommendations": ["string","string","string"]
}`,
      },
    ]));
  } catch (err) {
    if (err instanceof Error && err.message === "BUDGET_EXCEEDED") {
      return NextResponse.json(
        { error: "budget_exceeded", message: "Budget mensuel atteint (10€). Réinitialisé le 1er du mois." },
        { status: 402 }
      );
    }
    throw err;
  }

  // Log usage
  const { input_tokens, output_tokens } = message.usage;
  const cost_usd = calcCost(input_tokens, output_tokens);
  void supabase.from("usage_logs").insert({
    action: "my_posts_analyze",
    model: SONNET,
    input_tokens,
    output_tokens,
    cost_usd,
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  try {
    const result = JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Réponse invalide de Claude." }, { status: 500 });
  }
}
