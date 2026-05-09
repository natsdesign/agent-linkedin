import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveAccountId } from "@/lib/account-context";

export async function GET() {
  const supabase = createClient();
  const accountId = await getActiveAccountId();

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const { accountId } = await req.json();
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const res = NextResponse.json({ success: true });
  res.cookies.set("active_account", accountId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
