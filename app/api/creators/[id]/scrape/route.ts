import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startScraping } from "@/lib/apify";

type Params = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createClient();

    const { data: creator, error } = await supabase
      .from("creators")
      .select("id, linkedin_url")
      .eq("id", params.id)
      .single();

    if (error || !creator) {
      return NextResponse.json({ error: "Créateur introuvable." }, { status: 404 });
    }

    const runId = await startScraping(creator.linkedin_url);

    // Log Apify run (fire and forget)
    void supabase.from("apify_runs").insert({
      creator_id: params.id,
      run_id: runId,
      posts_scraped: 0,
      cost_usd: 0.002,
    });

    return NextResponse.json({ status: "started", runId });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
