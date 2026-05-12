import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";
import { guardedClaudeCall } from "@/lib/budget-guard";
import { getActiveAccountId } from "@/lib/account-context";

const SONNET = "claude-sonnet-4-6";

function calcCost(input: number, output: number) {
  return (input * 3.0 + output * 15.0) / 1_000_000;
}

type Angle = {
  type: "storytelling" | "liste" | "opinion" | "question";
  emoji: string;
  titre: string;
  description: string;
  hook_preview: string;
};

function buildSystemPrompt(profile: Record<string, unknown>): string {
  const lines: string[] = [
    "Tu es un ghostwriter LinkedIn expert. Tu écris des posts en français à la première personne.",
    "",
    "RÈGLES ABSOLUES :",
    "- Toujours à la première personne (je, mon, ma, mes)",
    "- Ancrer dans une anecdote ou situation concrète",
    "- Jamais de formulations génériques (« Il est important de… », « Nous devons… »)",
    "- 800 à 1500 caractères maximum",
    "- Terminer par une question ouverte pour engager la conversation",
    "- Zéro hashtag dans le corps du post",
    "- Retours à la ligne aérés pour la lisibilité mobile",
    "",
    "FORMAT DE RÉPONSE : objet JSON unique, sans markdown :",
    '{"content":"texte complet","hook":"première ligne","cta":"dernière ligne","format":"string"}',
  ];

  if (profile && Object.keys(profile).length > 0) {
    lines.push("", "PROFIL DU CRÉATEUR :");
    if (profile.name)            lines.push(`- Nom : ${profile.name}`);
    if (profile.niche)           lines.push(`- Niche : ${profile.niche}`);
    if (profile.target_audience) lines.push(`- Audience : ${profile.target_audience}`);
    if (profile.tone)            lines.push(`- Ton : ${profile.tone}`);
    if (Array.isArray(profile.goals) && (profile.goals as string[]).length > 0) {
      lines.push(`- Objectifs : ${(profile.goals as string[]).join(", ")}`);
    }
    if (profile.system_prompt)   lines.push("", profile.system_prompt as string);
  }

  return lines.join("\n");
}

function buildUserPrompt(
  context: string,
  angle: Angle,
  topPosts: Array<{ content: string }>,
  insights: { best_hooks?: Array<{ value: string }>; best_formats?: Array<{ value: string }>; best_themes?: Array<{ value: string }> }
): string {
  const parts: string[] = [];

  if (topPosts.length > 0) {
    parts.push("MES 3 MEILLEURS POSTS (style à imiter) :");
    topPosts.forEach((p, i) => {
      parts.push(`--- Post ${i + 1} ---\n${p.content.slice(0, 400)}`);
    });
    parts.push("");
  }

  if (insights.best_hooks?.length) {
    parts.push(`Accroches qui fonctionnent : ${insights.best_hooks.map((h) => h.value).join(", ")}`);
  }
  if (insights.best_formats?.length) {
    parts.push(`Formats performants : ${insights.best_formats.map((f) => f.value).join(", ")}`);
  }
  if (insights.best_themes?.length) {
    parts.push(`Thèmes qui résonnent : ${insights.best_themes.map((t) => t.value).join(", ")}`);
  }
  if (parts.length > 0) parts.push("");

  parts.push(`CONTEXTE DE LA SEMAINE :\n${context}`);
  parts.push("");
  parts.push(`ANGLE À DÉVELOPPER : ${angle.type.toUpperCase()}`);
  parts.push(`Titre : ${angle.titre}`);
  parts.push(`Description : ${angle.description}`);
  parts.push(`Accroche suggérée : ${angle.hook_preview}`);
  parts.push("");
  parts.push("Génère le post complet pour cet angle. Respecte strictement les règles du system prompt.");

  return parts.join("\n");
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const accountId = await getActiveAccountId();
  const { context, angles } = await req.json() as {
    context: string;
    angles: Angle[];
  };

  if (!context?.trim() || !Array.isArray(angles) || angles.length === 0) {
    return NextResponse.json({ error: "context et angles sont requis." }, { status: 400 });
  }

  // Fetch profile, insights, top 3 my_posts in parallel
  const [accountRes, insightsRes, topPostsRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", accountId).maybeSingle(),
    supabase.from("insights").select("best_hooks,best_formats,best_themes").eq("account_id", accountId).maybeSingle(),
    supabase
      .from("my_posts")
      .select("content,likes,comments,shares")
      .eq("account_id", accountId)
      .order("likes", { ascending: false })
      .limit(3),
  ]);

  const profile = accountRes.data ?? {};
  const insights = insightsRes.data ?? {};
  const topPosts = topPostsRes.data ?? [];

  const systemPrompt = buildSystemPrompt(profile);

  // Generate 1 post per angle (sequential to respect budget, parallel would waste tokens if budget runs out)
  const generated: Array<{ content: string; hook: string; cta: string; format: string; angle: Angle }> = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const angle of angles) {
    let message;
    try {
      message = await guardedClaudeCall(() =>
        anthropic.messages.create({
          model: SONNET,
          max_tokens: 800,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: buildUserPrompt(context, angle, topPosts, insights as { best_hooks?: Array<{ value: string }>; best_formats?: Array<{ value: string }>; best_themes?: Array<{ value: string }> }),
            },
          ],
        })
      );
    } catch (err) {
      if (err instanceof Error && err.message === "BUDGET_EXCEEDED") {
        return NextResponse.json(
          { error: "budget_exceeded", message: "Budget mensuel atteint (10€). Réinitialisé le 1er du mois." },
          { status: 402 }
        );
      }
      throw err;
    }

    totalInputTokens  += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;

    const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim());
      generated.push({ ...parsed, angle });
    } catch {
      // Skip invalid responses
    }
  }

  // Log usage (aggregated)
  void supabase.from("usage_logs").insert({
    action: "generate",
    model: SONNET,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cost_usd: calcCost(totalInputTokens, totalOutputTokens),
  });

  if (generated.length === 0) {
    return NextResponse.json({ error: "Génération échouée." }, { status: 502 });
  }

  // Insert into generated_posts
  const { data: inserted, error: insertError } = await supabase
    .from("generated_posts")
    .insert(
      generated.map((p) => ({
        account_id: accountId,
        content: p.content ?? "",
        hook:    p.hook    ?? "",
        cta:     p.cta     ?? "",
        subject: p.angle.titre,
        format:  p.format  ?? p.angle.type,
        status:  "draft",
      }))
    )
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Attach angle metadata (not stored in DB, just returned for the UI)
  const result = (inserted ?? []).map((row, i) => ({
    ...row,
    angle: generated[i]?.angle ?? null,
  }));

  return NextResponse.json(result);
}
