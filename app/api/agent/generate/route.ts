import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePosts } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();
  const { subjects, tone, count, format } = body as {
    subjects: string;
    tone: string;
    count: number;
    format: string;
  };

  if (!subjects || !tone || !count || !format) {
    return NextResponse.json({ error: "subjects, tone, count et format sont requis." }, { status: 400 });
  }

  const [profileRes, insightsRes] = await Promise.all([
    supabase.from("creator_profile").select("*").limit(1).maybeSingle(),
    supabase.from("insights").select("*").limit(1).maybeSingle(),
  ]);

  const profile = profileRes.data ?? {};
  const insights = insightsRes.data ?? { best_hooks: [], best_themes: [], best_formats: [] };

  // Generate posts with Claude Sonnet
  let generated;
  try {
    generated = await generatePosts({
      subjects,
      tone,
      count: Math.min(count, 10),
      format,
      profile: {
        niche: profile.niche,
        tone: profile.tone,
        target_audience: profile.target_audience,
        goals: profile.goals,
        context: profile.context,
      },
      insights: {
        best_hooks:   (insights.best_hooks   as { value: string; count: number }[]) ?? [],
        best_themes:  (insights.best_themes  as { value: string; count: number }[]) ?? [],
        best_formats: (insights.best_formats as { value: string; count: number }[]) ?? [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Génération échouée." },
      { status: 502 }
    );
  }

  // Batch insert into generated_posts
  const { data: inserted, error: insertError } = await supabase
    .from("generated_posts")
    .insert(
      generated.map((p) => ({
        content: p.content,
        hook: p.hook,
        cta: p.cta,
        subject: p.subject,
        format: p.format,
        status: "draft",
      }))
    )
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted);
}
