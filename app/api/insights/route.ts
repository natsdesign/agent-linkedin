import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export async function GET() {
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  const { data } = await supabase
    .from("insights")
    .select("*")
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();
  return NextResponse.json(data ?? null);
}
