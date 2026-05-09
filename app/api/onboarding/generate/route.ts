import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";

const SONNET = "claude-sonnet-4-6";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { answers, accountId } = body as { answers: string[]; accountId?: string };

  if (!answers || answers.length < 3) {
    return NextResponse.json({ error: "Réponses insuffisantes" }, { status: 400 });
  }

  const answersBlock = answers
    .map((a, i) => `Réponse ${i + 1} : ${a}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 1000,
    system: `Tu es un expert en personal branding LinkedIn. À partir des réponses d'onboarding d'un utilisateur, génère un profil de contenu structuré.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.`,
    messages: [
      {
        role: "user",
        content: `Voici les réponses d'onboarding :
${answersBlock}

Génère ce JSON pour configurer le compte :
{
  "name": "prénom ou nom court du compte (max 20 chars)",
  "niche": "domaine d'expertise en 5 mots max",
  "tone": "description du ton naturel en 10 mots max",
  "target_audience": "description précise de l'audience cible",
  "goals": ["objectif1", "objectif2"],
  "posting_frequency": 3,
  "system_prompt": "prompt système complet de 150-200 mots qui capture la voix unique, le style d'écriture, les sujets de prédilection, les valeurs, les contraintes et les objectifs de cette personne sur LinkedIn. Ce prompt sera utilisé pour générer du contenu personnalisé.",
  "summary": ["point clé 1 en 1 phrase", "point clé 2 en 1 phrase", "point clé 3 en 1 phrase"]
}`,
      },
    ],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  let parsed: Record<string, unknown>;
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Erreur de génération IA" }, { status: 502 });
  }

  const supabase = createClient();

  if (accountId) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        name: parsed.name as string,
        niche: parsed.niche as string,
        tone: parsed.tone as string,
        target_audience: parsed.target_audience as string,
        goals: parsed.goals as string[],
        posting_frequency: (parsed.posting_frequency as number) ?? 3,
        system_prompt: parsed.system_prompt as string,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ account: data, summary: parsed.summary });
  }

  // Create new account
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      name: parsed.name as string,
      niche: parsed.niche as string,
      tone: parsed.tone as string,
      target_audience: parsed.target_audience as string,
      goals: parsed.goals as string[],
      posting_frequency: (parsed.posting_frequency as number) ?? 3,
      system_prompt: parsed.system_prompt as string,
      onboarding_completed: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ account: data, summary: parsed.summary });
}
