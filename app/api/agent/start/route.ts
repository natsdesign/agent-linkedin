import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TONE_BASE = ["inspirant", "direct", "éducatif", "storytelling", "humour"];

export async function GET() {
  const supabase = createClient();

  const [profileRes, insightsRes] = await Promise.all([
    supabase.from("creator_profile").select("*").limit(1).maybeSingle(),
    supabase.from("insights").select("*").limit(1).maybeSingle(),
  ]);

  const profile = profileRes.data;
  const insights = insightsRes.data;

  // Q1 suggestions — best themes from insights, fallback to empty
  const bestThemes = (insights?.best_themes as { value: string }[] | null) ?? [];
  const themeSuggestions = bestThemes.slice(0, 6).map((t) => t.value);

  // Q2 suggestions — profile tone first, then generic alternatives
  const profileTone = profile?.tone;
  const toneSuggestions = profileTone
    ? [profileTone, ...TONE_BASE.filter((t) => t !== profileTone)].slice(0, 5)
    : TONE_BASE;

  // Q3 suggestions — combine defaultCount with top formats
  const bestFormats = (insights?.best_formats as { value: string }[] | null) ?? [];
  const topFormats = bestFormats.slice(0, 3).map((f) => f.value);
  const defaultCount = profile?.posting_frequency ?? 5;

  const formatSuggestions =
    topFormats.length > 0
      ? topFormats.map((f) => `${defaultCount} posts · ${f}`)
      : [`${defaultCount} posts · liste`, `${defaultCount} posts · storytelling`, `${defaultCount} posts · texte`];

  return NextResponse.json({
    question: "Sur quels sujets tu veux poster cette semaine ?",
    suggestions: themeSuggestions,
    toneSuggestions,
    formatSuggestions,
    defaultTone: profileTone ?? "inspirant",
    defaultCount,
  });
}
