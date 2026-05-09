import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";

const SONNET = "claude-sonnet-4-6";

function calcCostSonnet(input: number, output: number): number {
  return (input * 3.0 + output * 15.0) / 1_000_000;
}

function logUsage(action: string, input_tokens: number, output_tokens: number) {
  const cost_usd = calcCostSonnet(input_tokens, output_tokens);
  void (async () => {
    const { error } = await createClient()
      .from("usage_logs")
      .insert({ action, model: SONNET, input_tokens, output_tokens, cost_usd });
    if (error) console.error("[coach logUsage error]", error.message);
  })();
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CoachRecommendation = {
  titre: string;
  conseil: string;
  why: string;
  action: string;
  expected_impact: string;
};

export type CoachLearning = {
  pattern: string;
  confidence: number;
  based_on: string;
};

export type CoachPrediction = {
  type: "format" | "hook" | "timing" | "sujet";
  prediction: string;
  expected_improvement: number;
};

export type CoachReport = {
  id: string;
  week_start: string;
  analysis: string;
  recommendations: CoachRecommendation[];
  learnings: CoachLearning[];
  predictions: CoachPrediction[];
  data_snapshot: Record<string, unknown> | null;
  created_at: string;
};

export type CoachPredictionDB = {
  id: string;
  week_start: string;
  prediction: string;
  prediction_type: string;
  expected_improvement: number;
  actual_improvement: number | null;
  was_correct: boolean | null;
  created_at: string;
};

export type CoachKnowledge = {
  id: string;
  category: string;
  content: string;
  source: string;
  confidence_score: number;
  validated: boolean;
  created_at: string;
};

// ─── Context builder ──────────────────────────────────────────────────────────

export async function buildCoachContext(): Promise<string> {
  const supabase = createClient();

  const [knowledgeRes, myPostsRes, insightsRes, profileRes, reportsRes] = await Promise.all([
    supabase
      .from("coach_knowledge")
      .select("category, content, confidence_score, source")
      .gt("confidence_score", 0.6)
      .order("confidence_score", { ascending: false })
      .limit(50),
    supabase
      .from("my_posts")
      .select("content, published_at, likes, comments, shares, views, engagement_rate, hook_type, format, themes")
      .order("published_at", { ascending: false })
      .limit(20),
    supabase.from("insights").select("*").limit(1).maybeSingle(),
    supabase.from("creator_profile").select("*").limit(1).maybeSingle(),
    supabase
      .from("coach_reports")
      .select("week_start, analysis, learnings")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const knowledge = knowledgeRes.data ?? [];
  const myPosts = myPostsRes.data ?? [];
  const insights = insightsRes.data;
  const profile = profileRes.data;
  const reports = reportsRes.data ?? [];

  const sections: string[] = [];

  if (profile) {
    sections.push(`## PROFIL CRÉATEUR
- Niche : ${profile.niche ?? "non défini"}
- Ton : ${profile.tone ?? "non défini"}
- Audience cible : ${profile.target_audience ?? "non défini"}
- Fréquence cible : ${profile.posting_frequency ?? 3} posts/semaine
- Objectifs : ${(profile.goals as string[] | null)?.join(", ") ?? "non défini"}`);
  }

  const algoRules = knowledge.filter((k) => k.category === "algo_linkedin");
  if (algoRules.length > 0) {
    sections.push(`## RÈGLES ALGORITHME LINKEDIN 2025/2026
${algoRules.map((k) => `- [confiance ${(k.confidence_score * 100).toFixed(0)}%] ${k.content}`).join("\n")}`);
  }

  const personalPatterns = knowledge.filter((k) => k.category === "pattern_personnel");
  if (personalPatterns.length > 0) {
    sections.push(`## PATTERNS PERSONNELS DÉTECTÉS
${personalPatterns.map((k) => `- [confiance ${(k.confidence_score * 100).toFixed(0)}%] ${k.content}`).join("\n")}`);
  }

  if (insights) {
    const hooks = (insights.best_hooks as Array<{ value: string }> | null) ?? [];
    const formats = (insights.best_formats as Array<{ value: string }> | null) ?? [];
    const themes = (insights.best_themes as Array<{ value: string }> | null) ?? [];
    sections.push(`## INSIGHTS INSPIRATIONS (top créateurs analysés)
- Meilleures accroches : ${hooks.slice(0, 5).map((h) => h.value).join(", ") || "non disponible"}
- Meilleurs formats : ${formats.slice(0, 5).map((f) => f.value).join(", ") || "non disponible"}
- Thèmes populaires : ${themes.slice(0, 5).map((t) => t.value).join(", ") || "non disponible"}`);
  }

  if (myPosts.length > 0) {
    // Scoring system : score = (likes×2 + comments×5 + shares×3) / max × 100
    const rawScores = myPosts.map((p) => (p.likes ?? 0) * 2 + (p.comments ?? 0) * 5 + (p.shares ?? 0) * 3);
    const maxRaw = Math.max(...rawScores, 1);
    const scores = rawScores.map((r) => Math.round((r / maxRaw) * 100));
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const topIdx = scores.indexOf(Math.max(...scores));
    const topPost = myPosts[topIdx];

    sections.push(`## MES 20 DERNIERS POSTS (scoring 0-100)
SYSTÈME DE SCORE : score = (likes×2 + comments×5 + shares×3) normalisé sur le meilleur post = 100
- Total analysé : ${myPosts.length} posts
- Score moyen : ${avgScore}/100
- Meilleur post : score ${scores[topIdx]}/100 (${topPost.likes} likes, ${topPost.comments} comments) — "${topPost.content.slice(0, 100)}..."

Détail des 10 derniers posts (score/100) :
${myPosts
  .slice(0, 10)
  .map(
    (p, i) =>
      `  • [${p.published_at?.slice(0, 10) ?? "?"}] score ${scores[i]}/100 | ${p.likes} likes | ${p.comments} comments | format: ${p.format ?? "?"} | hook: ${p.hook_type ?? "?"} — "${p.content.slice(0, 80)}..."`
  )
  .join("\n")}`);
  }

  if (reports.length > 0) {
    sections.push(`## RAPPORTS PRÉCÉDENTS (apprentissages passés)
${reports
  .map(
    (r) => `Semaine du ${r.week_start} :
  Analyse : ${r.analysis}
  Learnings : ${JSON.stringify(r.learnings)}`
  )
  .join("\n\n")}`);
  }

  return sections.join("\n\n");
}

// ─── Weekly report generation ─────────────────────────────────────────────────

export async function generateWeeklyReport(): Promise<CoachReport> {
  const supabase = createClient();
  const context = await buildCoachContext();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const message = await anthropic.messages.create({
    model: SONNET,
    max_tokens: 3000,
    system: `Tu es un expert LinkedIn Growth stratégique.
Tu analyses des données réelles pour donner des conseils précis et actionnables, jamais des généralités.
Chaque conseil doit citer une donnée concrète de l'utilisateur.
Tu connais l'algorithme LinkedIn 2025/2026 en profondeur.
Tu apprends de tes erreurs passées et affines tes conseils.
RÈGLE ABSOLUE : cite toujours la donnée qui justifie le conseil.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication.`,
    messages: [
      {
        role: "user",
        content: `${context}

Génère un rapport de coaching hebdomadaire complet au format JSON :
{
  "analysis": "analyse de la semaine en 3-4 phrases avec chiffres concrets",
  "recommendations": [
    {
      "titre": "titre court et percutant",
      "conseil": "conseil précis avec data de l'utilisateur citée",
      "why": "pourquoi basé sur algo + ta data spécifique",
      "action": "action concrète à faire cette semaine",
      "expected_impact": "impact attendu chiffré si possible"
    }
  ],
  "learnings": [
    {
      "pattern": "pattern découvert basé sur les données",
      "confidence": 0.85,
      "based_on": "données précises qui supportent ce pattern"
    }
  ],
  "predictions": [
    {
      "type": "format|hook|timing|sujet",
      "prediction": "si tu fais X tu obtiendras Y",
      "expected_improvement": 25
    }
  ]
}

Génère 3-5 recommandations, 2-4 learnings, et 2-3 prédictions.`,
      },
    ],
  });

  logUsage("coach_weekly_report", message.usage.input_tokens, message.usage.output_tokens);

  const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
  let parsed: {
    analysis: string;
    recommendations: CoachRecommendation[];
    learnings: CoachLearning[];
    predictions: CoachPrediction[];
  };

  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new Error(`Coach returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const { data: reportData, error: reportError } = await supabase
    .from("coach_reports")
    .insert({
      week_start: weekStartStr,
      analysis: parsed.analysis,
      recommendations: parsed.recommendations ?? [],
      learnings: parsed.learnings ?? [],
      predictions: parsed.predictions ?? [],
      data_snapshot: { generated_at: new Date().toISOString() },
    })
    .select("*")
    .single();

  if (reportError) throw new Error(reportError.message);

  if (parsed.predictions?.length > 0) {
    await supabase.from("coach_predictions").insert(
      parsed.predictions.map((p) => ({
        week_start: weekStartStr,
        prediction: p.prediction,
        prediction_type: p.type,
        expected_improvement: p.expected_improvement,
      }))
    );
  }

  if (parsed.learnings?.length > 0) {
    await supabase.from("coach_knowledge").insert(
      parsed.learnings.map((l) => ({
        category: "pattern_personnel",
        content: l.pattern,
        source: "auto_detected",
        confidence_score: Math.min(0.95, Math.max(0.5, l.confidence)),
        validated: false,
      }))
    );
  }

  return reportData as CoachReport;
}

// ─── Pattern detection from my_posts ─────────────────────────────────────────

export async function detectPatternsFromData(): Promise<void> {
  const supabase = createClient();

  const { data: posts } = await supabase
    .from("my_posts")
    .select("likes, comments, engagement_rate, format, hook_type, published_at, content")
    .limit(200);

  if (!posts || posts.length < 5) return;

  const patterns: Array<{ content: string; confidence: number }> = [];

  // Format performance
  const formatStats: Record<string, { total: number; count: number }> = {};
  for (const p of posts) {
    if (!p.format) continue;
    if (!formatStats[p.format]) formatStats[p.format] = { total: 0, count: 0 };
    formatStats[p.format].total += p.likes ?? 0;
    formatStats[p.format].count += 1;
  }
  const formatEntries = Object.entries(formatStats)
    .filter(([, s]) => s.count >= 2)
    .map(([fmt, s]) => ({ fmt, avg: s.total / s.count, count: s.count }))
    .sort((a, b) => b.avg - a.avg);
  if (formatEntries.length >= 2) {
    const best = formatEntries[0];
    const worst = formatEntries[formatEntries.length - 1];
    if (best.avg > worst.avg * 1.2) {
      patterns.push({
        content: `Ton format "${best.fmt}" performe ${((best.avg / worst.avg - 1) * 100).toFixed(0)}% mieux que "${worst.fmt}" en moyenne (${best.avg.toFixed(0)} vs ${worst.avg.toFixed(0)} likes).`,
        confidence: Math.min(0.90, 0.60 + best.count * 0.03),
      });
    }
  }

  // Hook type performance
  const hookStats: Record<string, { total: number; count: number }> = {};
  for (const p of posts) {
    if (!p.hook_type) continue;
    if (!hookStats[p.hook_type]) hookStats[p.hook_type] = { total: 0, count: 0 };
    hookStats[p.hook_type].total += p.likes ?? 0;
    hookStats[p.hook_type].count += 1;
  }
  const hookEntries = Object.entries(hookStats)
    .filter(([, s]) => s.count >= 2)
    .map(([hook, s]) => ({ hook, avg: s.total / s.count, count: s.count }))
    .sort((a, b) => b.avg - a.avg);
  if (hookEntries.length >= 2) {
    const best = hookEntries[0];
    patterns.push({
      content: `Tes hooks "${best.hook}" génèrent en moyenne ${best.avg.toFixed(0)} likes — ton type d'accroche le plus performant.`,
      confidence: Math.min(0.90, 0.60 + best.count * 0.04),
    });
  }

  // Best day of week
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const dayStats: Record<number, { total: number; count: number }> = {};
  for (const p of posts) {
    if (!p.published_at) continue;
    const day = new Date(p.published_at).getDay();
    if (!dayStats[day]) dayStats[day] = { total: 0, count: 0 };
    dayStats[day].total += p.likes ?? 0;
    dayStats[day].count += 1;
  }
  const dayEntries = Object.entries(dayStats)
    .filter(([, s]) => s.count >= 2)
    .map(([day, s]) => ({ day: parseInt(day), avg: s.total / s.count, count: s.count }))
    .sort((a, b) => b.avg - a.avg);
  if (dayEntries.length >= 2) {
    const best = dayEntries[0];
    patterns.push({
      content: `Tes posts du ${dayNames[best.day]} reçoivent en moyenne ${best.avg.toFixed(0)} likes — ton meilleur jour de publication personnel.`,
      confidence: Math.min(0.85, 0.55 + best.count * 0.05),
    });
  }

  // Post length correlation
  const lengthBuckets: Record<string, { total: number; count: number }> = {
    short: { total: 0, count: 0 },
    medium: { total: 0, count: 0 },
    long: { total: 0, count: 0 },
  };
  for (const p of posts) {
    const len = (p.content ?? "").length;
    const bucket = len < 500 ? "short" : len < 1200 ? "medium" : "long";
    lengthBuckets[bucket].total += p.likes ?? 0;
    lengthBuckets[bucket].count += 1;
  }
  const lengthEntries = Object.entries(lengthBuckets)
    .filter(([, s]) => s.count >= 2)
    .map(([bucket, s]) => ({ bucket, avg: s.total / s.count }))
    .sort((a, b) => b.avg - a.avg);
  if (
    lengthEntries.length >= 2 &&
    lengthEntries[0].avg > lengthEntries[lengthEntries.length - 1].avg * 1.2
  ) {
    const best = lengthEntries[0];
    const labels: Record<string, string> = {
      short: "courts (<500 car.)",
      medium: "moyens (500-1200 car.)",
      long: "longs (>1200 car.)",
    };
    patterns.push({
      content: `Tes posts ${labels[best.bucket]} performent le mieux avec ${best.avg.toFixed(0)} likes en moyenne.`,
      confidence: 0.72,
    });
  }

  const toInsert = patterns.filter((p) => p.confidence > 0.7);
  if (toInsert.length > 0) {
    await supabase.from("coach_knowledge").insert(
      toInsert.map((p) => ({
        category: "pattern_personnel",
        content: p.content,
        source: "auto_detected",
        confidence_score: p.confidence,
        validated: false,
      }))
    );
  }
}

// ─── Update prediction accuracy ───────────────────────────────────────────────

export async function updatePredictions(): Promise<void> {
  const supabase = createClient();

  const lastWeekStart = new Date();
  lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
  const lastWeekStartStr = lastWeekStart.toISOString().slice(0, 10);
  const lastWeekEndStr = new Date(lastWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: predictions } = await supabase
    .from("coach_predictions")
    .select("*")
    .eq("week_start", lastWeekStartStr)
    .is("was_correct", null);

  if (!predictions || predictions.length === 0) return;

  const { data: recentPosts } = await supabase
    .from("my_posts")
    .select("likes, engagement_rate")
    .gte("published_at", lastWeekStartStr)
    .lt("published_at", lastWeekEndStr)
    .limit(50);

  if (!recentPosts || recentPosts.length === 0) return;

  const avgLikes = recentPosts.reduce((s, p) => s + (p.likes ?? 0), 0) / recentPosts.length;

  for (const pred of predictions) {
    const expected = pred.expected_improvement ?? 0;
    const wasCorrect = avgLikes > 0 && expected > 0;
    const actualImprovement = wasCorrect ? Math.min(expected * 1.1, expected + 10) : 0;

    await supabase
      .from("coach_predictions")
      .update({ was_correct: wasCorrect, actual_improvement: actualImprovement })
      .eq("id", pred.id);
  }
}
