import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = createClient();

  const { error } = await supabase
    .from("creators")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const supabase = createClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("creators")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
