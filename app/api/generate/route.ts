import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/claude";

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages }: { messages: Message[] } = await req.json();

  // Fetch user's creator profile for context
  const { data: profile } = await supabase
    .from("creator_profile")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const systemPrompt = `You are an expert LinkedIn ghostwriter and content strategist.
Your role is to help the user craft compelling, authentic LinkedIn posts.

${profile ? `User context:
- Name: ${profile.name ?? "Unknown"}
- Headline: ${profile.headline ?? "Not set"}
- Tone: ${profile.tone ?? "professional"}
- Topics: ${(profile.topics ?? []).join(", ") || "Not specified"}` : ""}

When the user provides enough information to write a post, generate it and include it in a JSON response:
{
  "message": "Your conversational response here",
  "post": "The full LinkedIn post content here (or null if not ready yet)"
}

Always respond with valid JSON. Be conversational and helpful. Ask clarifying questions if needed.
Posts should have: a strong hook, value/story, and a call to action when appropriate.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";

  let parsed: { message: string; post: string | null };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { message: text, post: null };
  }

  // Save generated post as draft if present
  if (parsed.post) {
    await supabase.from("generated_posts").insert({
      user_id: user.id,
      content: parsed.post,
      status: "draft",
    });
  }

  return NextResponse.json({ content: parsed.message, post: parsed.post });
}
