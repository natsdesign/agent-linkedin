import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // ── Anthropic: all time ──
  const { data: allLogs } = await supabase
    .from("usage_logs")
    .select("cost_usd, input_tokens, output_tokens, action, model, created_at")
    .order("created_at", { ascending: false });

  const logs = allLogs ?? [];
  const anthropic_total_usd     = logs.reduce((s, r) => s + parseFloat(String(r.cost_usd ?? 0)), 0);
  const anthropic_calls_count   = logs.length;
  const anthropic_input_tokens  = logs.reduce((s, r) => s + (r.input_tokens ?? 0), 0);
  const anthropic_output_tokens = logs.reduce((s, r) => s + (r.output_tokens ?? 0), 0);

  // ── Anthropic: this month ──
  const { data: monthLogs } = await supabase
    .from("usage_logs")
    .select("cost_usd")
    .gte("created_at", monthStart);

  const anthropic_month_usd = (monthLogs ?? []).reduce(
    (s, r) => s + parseFloat(String(r.cost_usd ?? 0)),
    0
  );

  // ── Apify: all time ──
  const { data: allRuns } = await supabase
    .from("apify_runs")
    .select("cost_usd, posts_scraped");

  const runs = allRuns ?? [];
  const apify_runs_count    = runs.length;
  const apify_posts_scraped = runs.reduce((s, r) => s + (r.posts_scraped ?? 0), 0);
  const apify_total_usd     = runs.reduce((s, r) => s + parseFloat(String(r.cost_usd ?? 0)), 0);

  // ── Apify: this month ──
  const { data: monthRuns } = await supabase
    .from("apify_runs")
    .select("cost_usd")
    .gte("created_at", monthStart);

  const apify_month_usd = (monthRuns ?? []).reduce(
    (s, r) => s + parseFloat(String(r.cost_usd ?? 0)),
    0
  );

  // ── Recent actions (last 10) ──
  const recent = logs.slice(0, 10);

  return NextResponse.json({
    anthropic: {
      total_usd:     anthropic_total_usd,
      this_month_usd: anthropic_month_usd,
      calls_count:   anthropic_calls_count,
      input_tokens:  anthropic_input_tokens,
      output_tokens: anthropic_output_tokens,
    },
    apify: {
      runs_count:    apify_runs_count,
      posts_scraped: apify_posts_scraped,
      total_usd:     apify_total_usd,
      this_month_usd: apify_month_usd,
    },
    total_usd:      anthropic_total_usd + apify_total_usd,
    this_month_usd: anthropic_month_usd + apify_month_usd,
    recent,
  });
}
