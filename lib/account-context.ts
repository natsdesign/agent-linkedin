import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const COOKIE_NAME = "active_account";
const DEFAULT_ACCOUNT_ID = "00000000-0000-0000-0000-000000000001";

export async function getActiveAccountId(): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(COOKIE_NAME)?.value;
  if (fromCookie) return fromCookie;

  const supabase = createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? DEFAULT_ACCOUNT_ID;
}

export async function setActiveAccountId(id: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
