import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export async function GET() {
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  const { data, error } = await supabase
    .from("generated_posts")
    .select("id,content,subject,format,created_at")
    .eq("account_id", accountId)
    .eq("status", "validated")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return NextResponse.json([], { status: 200 });
  return NextResponse.json(data ?? []);
}
