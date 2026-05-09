import { createClient } from "@/lib/supabase/server";

const MONTHLY_BUDGET_USD = 10;
const USD_TO_EUR = 0.92;

export async function checkBudget(): Promise<{
  allowed: boolean;
  used: number;
  remaining: number;
}> {
  const supabase = createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: usageLogs }, { data: apifyRuns }] = await Promise.all([
    supabase
      .from("usage_logs")
      .select("cost_usd")
      .gte("created_at", monthStart),
    supabase
      .from("apify_runs")
      .select("cost_usd")
      .gte("created_at", monthStart),
  ]);

  const anthropicTotal = (usageLogs ?? []).reduce(
    (sum, r) => sum + (parseFloat(String(r.cost_usd)) || 0),
    0
  );
  const apifyTotal = (apifyRuns ?? []).reduce(
    (sum, r) => sum + (parseFloat(String(r.cost_usd)) || 0),
    0
  );
  const usedUsd = anthropicTotal + apifyTotal;
  const usedEur = usedUsd * USD_TO_EUR;
  const remaining = Math.max(0, MONTHLY_BUDGET_USD * USD_TO_EUR - usedEur);

  if (usedEur >= MONTHLY_BUDGET_USD * 0.9) {
    console.warn(`[budget-guard] ⚠️ Budget à ${((usedEur / (MONTHLY_BUDGET_USD * USD_TO_EUR)) * 100).toFixed(0)}% — ${remaining.toFixed(2)}€ restants`);
  }

  return {
    allowed: usedEur < MONTHLY_BUDGET_USD * USD_TO_EUR,
    used: usedEur,
    remaining,
  };
}

export async function guardedClaudeCall<T>(fn: () => Promise<T>): Promise<T> {
  const { allowed } = await checkBudget();
  if (!allowed) {
    throw new Error("BUDGET_EXCEEDED");
  }
  return fn();
}
