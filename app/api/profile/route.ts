import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("creator_profile")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();

  // Single-user: upsert by checking existing row first
  const { data: existing } = await supabase
    .from("creator_profile")
    .select("id")
    .limit(1)
    .maybeSingle();

  let result;
  if (existing) {
    result = await supabase
      .from("creator_profile")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from("creator_profile")
      .insert(body)
      .select()
      .single();
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json(result.data, { status: existing ? 200 : 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const body = await req.json();

  const { data: existing } = await supabase
    .from("creator_profile")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("creator_profile")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
