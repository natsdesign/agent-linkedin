import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createClient();

  // Get the first account (oldest)
  const { data: firstAccount, error: accountError } = await supabase
    .from("accounts")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (accountError || !firstAccount) {
    return NextResponse.json({ error: "Aucun compte trouvé." }, { status: 404 });
  }

  const accountId = firstAccount.id;
  const tables = [
    "creators",
    "scraped_posts",
    "generated_posts",
    "my_posts",
    "insights",
    "daily_reports",
    "usage_logs",
  ] as const;

  const results: Record<string, number | string> = {
    target_account_id: accountId,
    target_account_name: firstAccount.name,
  };

  for (const table of tables) {
    const { error, data } = await supabase
      .from(table)
      .update({ account_id: accountId })
      .is("account_id", null)
      .select("id");

    results[table] = error ? `erreur: ${error.message}` : (data?.length ?? 0);
  }

  return NextResponse.json(results);
}
