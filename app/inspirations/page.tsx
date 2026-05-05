"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, PenSquare, ChevronDown } from "lucide-react";
import { AddCreatorModal } from "@/components/inspirations/AddCreatorModal";
import { CreatorCard } from "@/components/inspirations/CreatorCard";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Category, CreatorWithCount } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = { label: string; value: Category | null };

type InsightEntry = { value: string; count: number; percentage: number };

type InsightData = {
  best_hooks: InsightEntry[];
  best_formats: InsightEntry[];
  best_themes: InsightEntry[];
};

type CronLog = {
  id: string;
  ran_at: string;
  creators_scraped: number;
  posts_added: number;
  errors: unknown[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: Tab[] = [
  { label: "Tous",           value: null },
  { label: "Concurrents",    value: "competitor" },
  { label: "Top créateurs",  value: "top_creator" },
  { label: "Influenceurs",   value: "influencer" },
];

const EMPTY_LABELS: Record<string, string> = {
  competitor:  "Aucun concurrent suivi",
  top_creator: "Aucun top créateur suivi",
  influencer:  "Aucun influenceur suivi",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-gray-800 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-gray-800 rounded w-3/5" />
          <div className="h-2.5 bg-gray-800 rounded w-4/5" />
        </div>
      </div>
      <div className="flex justify-between pt-1 border-t border-white/5">
        <div className="h-2.5 bg-gray-800 rounded w-1/4" />
        <div className="h-2.5 bg-gray-800 rounded w-1/4" />
      </div>
      <div className="h-7 bg-gray-800 rounded-lg" />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab, onAdd }: { tab: Category | null; onAdd: () => void }) {
  const label = tab
    ? EMPTY_LABELS[tab]
    : "Ajoutez votre premier créateur pour commencer";
  const sub = tab
    ? "Ajoutez un créateur dans cette catégorie pour commencer à analyser son contenu."
    : "Ajoutez des créateurs LinkedIn pour analyser leur style et générer des posts inspirés de leur contenu.";

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-4">
        <Users size={26} className="text-brand-400" />
      </div>
      <h2 className="text-base font-semibold text-white mb-2">{label}</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs leading-relaxed">{sub}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-all"
      >
        <Plus size={15} />
        Ajouter un créateur
      </button>
    </div>
  );
}

// ─── Insights section ─────────────────────────────────────────────────────────

function InsightsSection({ data }: { data: InsightData | null }) {
  const hasData =
    data &&
    (data.best_hooks.length > 0 ||
      data.best_formats.length > 0 ||
      data.best_themes.length > 0);

  return (
    <div className="mt-10">
      <h2 className="text-base font-semibold text-white mb-4">Insights</h2>
      {!hasData ? (
        <div className="glass rounded-xl p-6 text-center">
          <p className="text-sm text-gray-500">
            Scrapez des créateurs pour voir les insights apparaître ici
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Top Hooks */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Top Hooks
            </h3>
            <div className="space-y-2.5">
              {data!.best_hooks.slice(0, 3).map((hook) => (
                <div key={hook.value} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-300 capitalize truncate">{hook.value}</span>
                  <span className="text-xs font-semibold text-brand-400 shrink-0">{hook.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Formats */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Top Formats
            </h3>
            <div className="space-y-2.5">
              {data!.best_formats.slice(0, 3).map((fmt) => (
                <div key={fmt.value} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-300 capitalize truncate">{fmt.value}</span>
                  <span className="text-xs font-semibold text-brand-400 shrink-0">{fmt.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Themes */}
          <div className="glass rounded-xl p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Top Thèmes
            </h3>
            <div className="flex flex-wrap gap-2">
              {data!.best_themes.slice(0, 5).map((theme) => (
                <span
                  key={theme.value}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 border border-gray-700 text-gray-300 hover:border-brand-500/50 hover:text-brand-300 transition-colors cursor-default"
                >
                  {theme.value}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cron section ────────────────────────────────────────────────────────────

function CronSection({ logs }: { logs: CronLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pb-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-400 transition-colors"
      >
        <ChevronDown
          size={15}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
        Analyse automatique
      </button>

      {open && (
        <div className="mt-3 glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-xs text-gray-500">
              Prochain scraping : demain à 8h00
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-gray-500">Aucune analyse automatique effectuée</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-600">Date</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">Créateurs scrapés</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">Posts ajoutés</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-600">Erreurs</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {new Date(log.ran_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-gray-300">
                      {log.creators_scraped}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-gray-300">
                      {log.posts_added}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right">
                      <span
                        className={cn(
                          "font-medium",
                          Array.isArray(log.errors) && log.errors.length > 0
                            ? "text-red-400"
                            : "text-gray-600"
                        )}
                      >
                        {Array.isArray(log.errors) ? log.errors.length : 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InspirationsPage() {
  const [creators, setCreators] = useState<CreatorWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const { showToast } = useToast();

  async function fetchCreators() {
    const res = await fetch("/api/creators");
    if (res.ok) setCreators(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchCreators();
    fetch("/api/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then(setInsights)
      .catch(() => {});
    fetch("/api/cron/logs")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCronLogs)
      .catch(() => {});
  }, []);

  async function handleAdd(name: string, linkedinUrl: string, category: Category) {
    const res = await fetch("/api/creators", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, linkedin_url: linkedinUrl, category }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Erreur lors de l'ajout.");
    }
    const newCreator: CreatorWithCount = await res.json();
    setCreators((prev) => [newCreator, ...prev]);
    showToast("Créateur ajouté avec succès");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/creators/${id}`, { method: "DELETE" });
    setCreators((prev) => prev.filter((c) => c.id !== id));
  }

  const tabCounts = {
    all: creators.length,
    competitor: creators.filter((c) => c.category === "competitor").length,
    top_creator: creators.filter((c) => c.category === "top_creator").length,
    influencer: creators.filter((c) => c.category === "influencer").length,
  };

  const visible = activeTab
    ? creators.filter((c) => c.category === activeTab)
    : creators;

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold text-white">Inspirations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {creators.length} créateur{creators.length !== 1 ? "s" : ""} suivis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 hover:bg-white/5 rounded-lg transition-all"
          >
            <PenSquare size={15} />
            Créer des posts
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-all shadow-lg shadow-brand-900/30"
          >
            <Plus size={15} />
            Ajouter un créateur
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-800 pb-0">
        {TABS.map((tab) => {
          const count =
            tab.value === null ? tabCounts.all : tabCounts[tab.value];
          const active = activeTab === tab.value;

          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all -mb-px",
                active
                  ? "text-brand-400 border-brand-500"
                  : "text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-600"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                    active
                      ? "bg-brand-600/20 text-brand-400"
                      : "bg-gray-800 text-gray-500"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map((creator) => (
            <CreatorCard key={creator.id} creator={creator} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <EmptyState tab={activeTab} onAdd={() => setModalOpen(true)} />
      )}

      {/* Insights */}
      <InsightsSection data={insights} />

      {/* Cron */}
      <CronSection logs={cronLogs} />

      <AddCreatorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
