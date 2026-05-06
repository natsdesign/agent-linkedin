import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient();
  const { error } = await supabase.from("my_posts").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
