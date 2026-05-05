import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startScraping } from "@/lib/apify";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    console.log("1. Début scrape pour:", params.id);

    const supabase = createClient();

    const { data: creator, error } = await supabase
      .from("creators")
      .select("id, linkedin_url")
      .eq("id", params.id)
      .single();

    if (error || !creator) {
      return NextResponse.json({ error: "Créateur introuvable." }, { status: 404 });
    }

    console.log("2. Créateur trouvé:", creator.linkedin_url);
    console.log("3. Lancement Apify...");

    const runId = await startScraping(creator.linkedin_url);

    console.log("4. Run Apify lancé, runId:", runId);

    return NextResponse.json({ status: "started", runId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("SCRAPE ERROR:", err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
