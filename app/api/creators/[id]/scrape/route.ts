import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startScraping } from "@/lib/apify";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  const supabase = createClient();

  const { data: creator, error } = await supabase
    .from("creators")
    .select("id, linkedin_url")
    .eq("id", params.id)
    .single();

  if (error || !creator) {
    return NextResponse.json({ error: "Créateur introuvable." }, { status: 404 });
  }

  let runId: string;
  try {
    runId = await startScraping(creator.linkedin_url);
  } catch (err) {
    return NextResponse.json(
      { error: `Échec du démarrage : ${err instanceof Error ? err.message : "erreur inconnue"}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ status: "started", runId });
}
