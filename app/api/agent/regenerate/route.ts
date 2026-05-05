import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { regenerateSinglePost } from "@/lib/claude";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { post_id, subjects, tone, format } = await req.json() as {
    post_id: string;
    subjects: string;
    tone: string;
    format: string;
  };

  if (!post_id) {
    return NextResponse.json({ error: "post_id est requis." }, { status: 400 });
  }

  // Fetch current post to give Claude context
  const { data: currentPost, error: fetchError } = await supabase
    .from("generated_posts")
    .select("content, subject, format")
    .eq("id", post_id)
    .single();

  if (fetchError || !currentPost) {
    return NextResponse.json({ error: "Post introuvable." }, { status: 404 });
  }

  let regenerated;
  try {
    regenerated = await regenerateSinglePost({
      currentContent: currentPost.content,
      subject: currentPost.subject ?? subjects ?? "sujet LinkedIn",
      tone: tone ?? "inspirant",
      format: currentPost.format ?? format ?? "texte",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Régénération échouée." },
      { status: 502 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("generated_posts")
    .update({
      content: regenerated.content,
      hook: regenerated.hook,
      cta: regenerated.cta,
      status: "draft",
    })
    .eq("id", post_id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated);
}
