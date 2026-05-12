import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";
import { guardedClaudeCall } from "@/lib/budget-guard";
import { getActiveAccountId } from "@/lib/account-context";

const HAIKU = "claude-haiku-4-5-20251001";

function calcCost(input: number, output: number) {
  return (input * 0.80 + output * 4.00) / 1_000_000;
}

type Angle = {
  type: "storytelling" | "liste" | "opinion" | "question";
  emoji: string;
  titre: string;
  description: string;
  hook_preview: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const accountId = await getActiveAccountId();
  const { post_id, context, angle } = await req.json() as {
    post_id: string;
    context: string;
    angle?: Angle;
  };

  if (!post_id) {
    return NextResponse.json({ error: "post_id est requis." }, { status: 400 });
  }

  const { data: currentPost, error: fetchError } = await supabase
    .from("generated_posts")
    .select("content,subject,format")
    .eq("id", post_id)
    .eq("account_id", accountId)
    .single();

  if (fetchError || !currentPost) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  const angleContext = angle
    ? `Angle : ${angle.type} — ${angle.titre}\n${angle.description}\nAccroche suggérée : ${angle.hook_preview}\n\n`
    : "";

  const contextBlock = context?.trim()
    ? `Contexte de la semaine : ${context.trim().slice(0, 600)}\n\n`
    : "";

  let message;
  try {
    message = await guardedClaudeCall(() =>
      anthropic.messages.create({
        model: HAIKU,
        max_tokens: 800,
        system: `Tu es un ghostwriter LinkedIn. Régénère un post en français, à la première personne, plus percutant que la version actuelle.
RÈGLES : 800-1500 caractères, question ouverte en fin, zéro hashtag dans le corps, retours à la ligne aérés.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{"content":"texte complet","hook":"première ligne","cta":"dernière ligne","format":"string"}`,
        messages: [
          {
            role: "user",
            content: `${contextBlock}${angleContext}Version actuelle (à surpasser) :
${currentPost.content}

Génère une version différente et plus engageante pour le même angle.`,
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
    action: "regenerate",
    model: HAIKU,
    input_tokens,
    output_tokens,
    cost_usd: calcCost(input_tokens, output_tokens),
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  let parsed: { content?: string; hook?: string; cta?: string; format?: string };
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
  } catch {
    return NextResponse.json({ error: "Régénération échouée." }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("generated_posts")
    .update({
      content: parsed.content ?? currentPost.content,
      hook:    parsed.hook    ?? "",
      cta:     parsed.cta     ?? "",
      status:  "draft",
    })
    .eq("id", post_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
