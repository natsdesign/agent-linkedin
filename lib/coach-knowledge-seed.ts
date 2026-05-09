import { createClient } from "@/lib/supabase/server";

const LINKEDIN_ALGO_RULES = [
  "Les 90 premières minutes après publication sont cruciales. L'algorithme mesure le ratio engagement/impressions dans cette fenêtre pour décider du reach final.",
  "5 commentaires dans la première heure déclenchent un boost algorithmique significatif. Les commentaires ont 3x plus de poids que les likes.",
  "Les posts avec une question directe en fin de contenu génèrent en moyenne 3x plus de commentaires.",
  "La régularité prime sur la fréquence. 3 posts/semaine constants surpassent 7 posts/semaine irréguliers en termes de reach cumulé.",
  "Les hashtags : 3 maximum, préférer les hashtags de niche (<100K abonnés) aux hashtags génériques.",
  "Répondre à tous les commentaires dans la première heure double le reach du post selon les tests publics.",
  "Les posts trop promotionnels (mentions de prix, 'achetez', 'contactez-moi') sont pénalisés de 30-50% de reach.",
  "Le format carrousel (document PDF) génère le meilleur reach organique en 2025, suivi du texte long avec structure claire.",
  "Les posts entre 900 et 1500 caractères ont le meilleur engagement rate en moyenne sur LinkedIn.",
  "Mentionner 1-2 personnes pertinentes (pas du spam) expose le post à leur réseau et booste le reach de 20-40%.",
  "Le meilleur timing global : mardi, mercredi, jeudi entre 7h30 et 9h30. Mais ton timing optimal personnel peut varier.",
  "Un hook qui commence par un chiffre ou une statistique a 40% plus de chances d'être lu complètement.",
  "Les posts qui génèrent des débats (opinions tranchées) surperforment les posts informatifs en termes d'algorithme.",
  "LinkedIn pénalise les posts avec liens externes dans le corps du texte. Mets les liens en commentaire.",
  "La dwell time (temps passé sur le post) est un signal fort. Les posts avec 'voir plus' (longs) sont favorisés si le contenu retient l'attention.",
];

export async function seedCoachKnowledge(): Promise<{ seeded: number; message: string }> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("coach_knowledge")
    .select("id")
    .eq("source", "system")
    .limit(1);

  if (existing && existing.length > 0) {
    return { seeded: 0, message: "Already seeded" };
  }

  const rows = LINKEDIN_ALGO_RULES.map((content) => ({
    category: "algo_linkedin",
    content,
    source: "system",
    confidence_score: 0.85,
    validated: true,
  }));

  const { data, error } = await supabase.from("coach_knowledge").insert(rows).select("id");

  if (error) throw new Error(error.message);

  return { seeded: data?.length ?? 0, message: "Knowledge seeded successfully" };
}
