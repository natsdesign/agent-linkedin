import { createClient } from "@/lib/supabase/server";

type FrequencyEntry = { value: string; count: number; percentage: number };

function topByFrequency(
  values: (string | null | undefined)[],
  topN: number
): FrequencyEntry[] {
  const freq: Record<string, number> = {};
  let total = 0;

  for (const v of values) {
    if (v) {
      freq[v] = (freq[v] ?? 0) + 1;
      total++;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([value, count]) => ({
      value,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

export async function refreshInsights(): Promise<void> {
  const supabase = createClient();

  // Fetch all analyzed posts
  const { data: posts, error } = await supabase
    .from("scraped_posts")
    .select("hook_type, format, themes")
    .limit(1000);

  if (error || !posts || posts.length === 0) return;

  // Top 5 hook types
  const best_hooks = topByFrequency(
    posts.map((p) => p.hook_type),
    5
  );

  // Top 5 formats
  const best_formats = topByFrequency(
    posts.map((p) => p.format),
    5
  );

  // Top 10 themes — flatten all theme arrays
  const allThemes = posts.flatMap((p) =>
    Array.isArray(p.themes) ? (p.themes as string[]) : []
  );
  const best_themes = topByFrequency(allThemes, 10);

  const payload = {
    best_hooks,
    best_formats,
    best_themes,
    best_posting_times: [],
    updated_at: new Date().toISOString(),
  };

  // Single-row upsert
  const { data: existing } = await supabase
    .from("insights")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase.from("insights").update(payload).eq("id", existing.id);
  } else {
    await supabase.from("insights").insert(payload);
  }
}
