import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { guardedClaudeCall } from "@/lib/budget-guard";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── Cost helpers ──────────────────────────────────────────────────────────────

function calcCost(model: string, input: number, output: number): number {
  if (model.includes("haiku")) {
    return (input * 0.80 + output * 4.00) / 1_000_000;
  }
  // sonnet
  return (input * 3.00 + output * 15.00) / 1_000_000;
}

function logUsage(
  action: string,
  model: string,
  input_tokens: number,
  output_tokens: number
) {
  const cost_usd = calcCost(model, input_tokens, output_tokens);
  void (async () => {
    const { error } = await createClient()
      .from("usage_logs")
      .insert({ action, model, input_tokens, output_tokens, cost_usd });
    if (error) console.error("[logUsage error]", error.message);
  })();
}

// ─── Strip markdown fences ────────────────────────────────────────────────────

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

// ─── Post analysis (Haiku — bulk, cheap) ─────────────────────────────────────

export type PostAnalysis = {
  hook_type: "question" | "chiffre" | "statement" | "storytelling" | "liste";
  format: "texte" | "liste" | "storytelling" | "carrousel" | "court";
  themes: string[];
  engagement_prediction: "low" | "medium" | "high";
};

const ANALYSIS_FALLBACK: PostAnalysis = {
  hook_type: "statement",
  format: "texte",
  themes: [],
  engagement_prediction: "medium",
};

const HAIKU = "claude-haiku-4-5-20251001";
const SONNET = "claude-sonnet-4-6";

export async function analyzePost(content: string): Promise<PostAnalysis> {
  const message = await guardedClaudeCall(() => anthropic.messages.create({
    model: HAIKU,
    max_tokens: 150,
    system: `Analyze a LinkedIn post. Return ONLY a raw JSON object — no markdown, no explanation:
{"hook_type":"question"|"chiffre"|"statement"|"storytelling"|"liste","format":"texte"|"liste"|"storytelling"|"carrousel"|"court","themes":["theme1","theme2"],"engagement_prediction":"low"|"medium"|"high"}
themes: max 3 short strings in the post language.`,
    messages: [{ role: "user", content }],
  }));

  logUsage("analyze", HAIKU, message.usage.input_tokens, message.usage.output_tokens);

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    return JSON.parse(stripFences(raw)) as PostAnalysis;
  } catch {
    return ANALYSIS_FALLBACK;
  }
}

// ─── Batch post generation (Sonnet — quality) ─────────────────────────────────

export type GeneratedPostData = {
  content: string;
  hook: string;
  cta: string;
  subject: string;
  format: string;
};

type InsightEntry = { value: string; count: number };

export async function generatePosts(params: {
  subjects: string;
  tone: string;
  count: number;
  format: string;
  profile: {
    niche?: string | null;
    tone?: string | null;
    target_audience?: string | null;
    goals?: string[] | null;
    context?: string | null;
  };
  insights: {
    best_hooks: InsightEntry[];
    best_themes: InsightEntry[];
    best_formats: InsightEntry[];
  };
}): Promise<GeneratedPostData[]> {
  const { subjects, tone, count, format, profile, insights } = params;

  const profileBlock = [
    profile.niche           && `- Niche : ${profile.niche}`,
    profile.target_audience && `- Audience cible : ${profile.target_audience}`,
    profile.tone            && `- Ton habituel : ${profile.tone}`,
    profile.goals?.length   && `- Objectifs : ${profile.goals.join(", ")}`,
    profile.context         && `- Contexte : ${profile.context}`,
  ]
    .filter(Boolean)
    .join("\n");

  const hooksStr   = insights.best_hooks.map((h) => h.value).join(", ")   || "statement, question";
  const themesStr  = insights.best_themes.map((t) => t.value).join(", ")  || "non défini";
  const formatsStr = insights.best_formats.map((f) => f.value).join(", ") || "texte";

  const message = await guardedClaudeCall(() => anthropic.messages.create({
    model: SONNET,
    max_tokens: 4000,
    system: `Tu es un ghostwriter LinkedIn expert. Tu génères des posts LinkedIn percutants et authentiques en français.
IMPORTANT : Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans explication.
Format attendu : [{"content":"...","hook":"...","cta":"...","subject":"...","format":"..."}]`,
    messages: [
      {
        role: "user",
        content: `Profil du créateur :
${profileBlock || "- Profil non renseigné"}

Données de performance (posts qui ont bien engagé) :
- Meilleures accroches : ${hooksStr}
- Thèmes qui fonctionnent : ${themesStr}
- Formats populaires : ${formatsStr}

CONSIGNE :
Génère exactement ${count} posts LinkedIn sur les sujets suivants : ${subjects}
Ton demandé : ${tone}
Format principal : ${format}

Pour chaque post :
- Commence par une accroche forte et originale (hook)
- Développe avec de la valeur, un angle unique, une histoire ou des insights concrets
- Termine par un CTA engageant (question ouverte, invitation à réagir, etc.)
- Adapte la longueur et la structure au format "${format}"

Retourne exactement ${count} objets dans ce tableau JSON :
[{"content":"texte complet du post avec sauts de ligne","hook":"première ligne accroche","cta":"dernière ligne CTA","subject":"sujet traité","format":"${format}"}]`,
      },
    ],
  }));

  logUsage("generate", SONNET, message.usage.input_tokens, message.usage.output_tokens);

  const raw = message.content[0].type === "text" ? message.content[0].text : "[]";

  try {
    const parsed = JSON.parse(stripFences(raw));
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return parsed.slice(0, count) as GeneratedPostData[];
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`);
  }
}

// ─── Single post regeneration (Haiku — fast) ─────────────────────────────────

export async function regenerateSinglePost(params: {
  currentContent: string;
  subject: string;
  tone: string;
  format: string;
}): Promise<GeneratedPostData> {
  const { currentContent, subject, tone, format } = params;

  const message = await guardedClaudeCall(() => anthropic.messages.create({
    model: HAIKU,
    max_tokens: 800,
    system: `Tu es un ghostwriter LinkedIn. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{"content":"...","hook":"...","cta":"...","subject":"...","format":"..."}`,
    messages: [
      {
        role: "user",
        content: `Régénère ce post LinkedIn sur "${subject}" avec un ton "${tone}" en format "${format}".
Rends-le différent et plus percutant que la version actuelle.

Version actuelle (à surpasser) :
${currentContent}`,
      },
    ],
  }));

  logUsage("regenerate", HAIKU, message.usage.input_tokens, message.usage.output_tokens);

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    return JSON.parse(stripFences(raw)) as GeneratedPostData;
  } catch {
    throw new Error("Regeneration failed: invalid JSON response");
  }
}

// ─── Daily report generation (Haiku — cheap) ─────────────────────────────────

export type DailyReport = {
  insights_summary: string;
  recommendations: string[];
};

export async function generateDailyReport(params: {
  newPostsCount: number;
  topPosts: Array<{ content: string; likes: number; creator: string }>;
}): Promise<DailyReport> {
  const { newPostsCount, topPosts } = params;
  const postsStr = topPosts
    .map((p, i) => `Post ${i + 1} (${p.creator}, ${p.likes} likes) :\n${p.content.slice(0, 300)}`)
    .join("\n\n");

  const message = await guardedClaudeCall(() => anthropic.messages.create({
    model: HAIKU,
    max_tokens: 400,
    system: `Tu es un analyste contenu LinkedIn. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown :
{"insights_summary":"résumé en 2 phrases","recommendations":["reco 1","reco 2","reco 3"]}`,
    messages: [
      {
        role: "user",
        content: `${newPostsCount} nouveau${newPostsCount > 1 ? "x" : ""} post${newPostsCount > 1 ? "s" : ""} scraped aujourd'hui.

${topPosts.length > 0 ? `Top posts :\n${postsStr}` : "Aucun nouveau post."}

Génère un résumé des tendances (2 phrases max) et exactement 3 recommandations actionnables pour le contenu de cette semaine.`,
      },
    ],
  }));

  logUsage("daily_report", HAIKU, message.usage.input_tokens, message.usage.output_tokens);

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  try {
    const parsed = JSON.parse(stripFences(raw));
    return {
      insights_summary: parsed.insights_summary ?? "",
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3) : [],
    };
  } catch {
    return { insights_summary: "Analyse non disponible.", recommendations: [] };
  }
}

// ─── Conversational generate (legacy, kept for /api/generate) ─────────────────

export async function generatePost(params: {
  topic: string;
  tone: string;
  profile?: { niche?: string | null; target_audience?: string | null; context?: string | null };
}): Promise<string> {
  const profileLines = params.profile
    ? [
        params.profile.niche           && `Niche: ${params.profile.niche}`,
        params.profile.target_audience && `Audience: ${params.profile.target_audience}`,
        params.profile.context         && `Context: ${params.profile.context}`,
      ].filter(Boolean).join("\n")
    : "";

  const message = await guardedClaudeCall(() => anthropic.messages.create({
    model: SONNET,
    max_tokens: 1024,
    system: `You are an expert LinkedIn ghostwriter. Write compelling, authentic posts that drive engagement.
Use line breaks for readability, a strong opening hook, and a clear call to action when relevant.`,
    messages: [
      {
        role: "user",
        content: `Write a LinkedIn post about: ${params.topic}\nTone: ${params.tone}\n${profileLines}`,
      },
    ],
  }));

  logUsage("generate", SONNET, message.usage.input_tokens, message.usage.output_tokens);

  return message.content[0].type === "text" ? message.content[0].text : "";
}
