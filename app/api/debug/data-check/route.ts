import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const activeAccountId = await getActiveAccountId();

  const [
    creatorsTotal,
    creatorsWithAccount,
    scrapedPostsTotal,
    scrapedPostsWithAccount,
    accounts,
  ] = await Promise.all([
    supabase.from("creators").select("id", { count: "exact", head: true }),
    supabase.from("creators").select("id", { count: "exact", head: true }).not("account_id", "is", null),
    supabase.from("scraped_posts").select("id", { count: "exact", head: true }),
    supabase.from("scraped_posts").select("id", { count: "exact", head: true }).not("account_id", "is", null),
    supabase.from("accounts").select("id, name, type, created_at").order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({
    creators_total: creatorsTotal.count ?? 0,
    creators_with_account: creatorsWithAccount.count ?? 0,
    scraped_posts_total: scrapedPostsTotal.count ?? 0,
    scraped_posts_with_account: scrapedPostsWithAccount.count ?? 0,
    accounts: accounts.data ?? [],
    active_account_id: activeAccountId,
  });
}
