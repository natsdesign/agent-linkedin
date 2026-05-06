"use client";

import { useEffect, useState } from "react";
import { X, Zap, Bot, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentLog = {
  id: string;
  action: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
};

type CostData = {
  anthropic: {
    total_usd: number;
    this_month_usd: number;
    calls_count: number;
    input_tokens: number;
    output_tokens: number;
  };
  apify: {
    runs_count: number;
    posts_scraped: number;
    total_usd: number;
    this_month_usd: number;
  };
  total_usd: number;
  this_month_usd: number;
  recent: RecentLog[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BUDGET_EUR = 10;
const USD_TO_EUR = 0.92;

function fmt(usd: number) {
  return (usd * USD_TO_EUR).toFixed(2);
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

const ACTION_LABEL: Record<string, string> = {
  analyze:    "Analyse",
  generate:   "Génération",
  regenerate: "Regénération",
};

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-sonnet-4-6":         "Sonnet",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <div className="text-right">
        <span className="text-sm font-semibold text-zinc-800">{value}</span>
        {sub && <span className="text-xs text-zinc-400 ml-1.5">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CostDrawer({ open, onClose }: Props) {
  const [data,    setData]    = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/costs", { cache: "no-store", headers: { "Cache-Control": "no-cache" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const monthEur  = data ? parseFloat(fmt(data.this_month_usd)) : 0;
  const budgetPct = Math.min((monthEur / BUDGET_EUR) * 100, 100);

  const budgetColor =
    budgetPct >= 80 ? "bg-red-400" :
    budgetPct >= 50 ? "bg-amber-400" :
    "bg-brand-500";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white border-l border-zinc-200 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center">
              <TrendingUp size={14} className="text-zinc-500" />
            </div>
            <h2 className="font-semibold text-zinc-900 text-sm">Suivi des coûts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={20} className="animate-spin text-zinc-300" />
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-zinc-400">Impossible de charger les données</p>
            </div>
          ) : (
            <>
              {/* Hero — total du mois */}
              <div className="px-5 py-6 border-b border-zinc-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-1">
                  Ce mois-ci
                </p>
                <p className="text-4xl font-semibold text-zinc-900 tracking-tight leading-none mb-1">
                  {fmt(data.this_month_usd)}€
                </p>
                <p className="text-xs text-zinc-400 mb-4">
                  sur {BUDGET_EUR}€ de budget
                </p>

                {/* Progress bar */}
                <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", budgetColor)}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-zinc-400">{budgetPct.toFixed(0)}% utilisé</span>
                  <span className="text-[11px] text-zinc-400">
                    {(BUDGET_EUR - monthEur).toFixed(2)}€ restants
                  </span>
                </div>
              </div>

              {/* Anthropic section */}
              <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={14} className="text-violet-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    Anthropic Claude
                  </h3>
                </div>
                <StatRow
                  label="Ce mois"
                  value={`${fmt(data.anthropic.this_month_usd)}€`}
                />
                <StatRow
                  label="Total cumulé"
                  value={`${fmt(data.anthropic.total_usd)}€`}
                />
                <StatRow
                  label="Appels API"
                  value={String(data.anthropic.calls_count)}
                />
                <StatRow
                  label="Tokens consommés"
                  value={fmtNum(data.anthropic.input_tokens + data.anthropic.output_tokens)}
                  sub={`${fmtNum(data.anthropic.input_tokens)} in · ${fmtNum(data.anthropic.output_tokens)} out`}
                />
              </div>

              {/* Apify section */}
              <div className="px-5 py-4 border-b border-zinc-100">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-amber-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                    Apify Scraping
                  </h3>
                </div>
                <StatRow
                  label="Ce mois"
                  value={`${fmt(data.apify.this_month_usd)}€`}
                />
                <StatRow
                  label="Total cumulé"
                  value={`${fmt(data.apify.total_usd)}€`}
                />
                <StatRow
                  label="Runs de scraping"
                  value={String(data.apify.runs_count)}
                />
                <StatRow
                  label="Posts scrapés"
                  value={fmtNum(data.apify.posts_scraped)}
                />
              </div>

              {/* Recent actions */}
              <div className="px-5 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
                  Dernières actions
                </h3>

                {data.recent.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-6">
                    Aucune action enregistrée
                  </p>
                ) : (
                  <div className="space-y-0 divide-y divide-zinc-100">
                    {data.recent.map((log) => (
                      <div key={log.id} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-zinc-700">
                              {ACTION_LABEL[log.action] ?? log.action}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 shrink-0">
                              {MODEL_SHORT[log.model] ?? log.model}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {new Date(log.created_at).toLocaleDateString("fr-FR", {
                              day:    "2-digit",
                              month:  "2-digit",
                              hour:   "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs font-semibold text-zinc-700">
                            {(parseFloat(String(log.cost_usd)) * USD_TO_EUR * 1000).toFixed(2)}m€
                          </p>
                          <p className="text-[10px] text-zinc-400">
                            {fmtNum((log.input_tokens ?? 0) + (log.output_tokens ?? 0))} tok
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
          <p className="text-[11px] text-zinc-400 text-center">
            USD → EUR · taux fixe {USD_TO_EUR} · budget {BUDGET_EUR}€/mois
          </p>
        </div>
      </div>
    </>
  );
}
