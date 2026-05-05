"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Users,
  PenSquare,
  ChevronDown,
  FileText,
  Layout,
  Hash,
  TrendingUp,
} from "lucide-react";
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
  { label: "Tous",          value: null },
  { label: "Concurrents",   value: "competitor" },
  { label: "Top créateurs", value: "top_creator" },
  { label: "Influenceurs",  value: "influencer" },
];

const EMPTY_LABELS: Record<string, string> = {
  competitor:  "Aucun concurrent suivi",
  top_creator: "Aucun top créateur suivi",
  influencer:  "Aucun influenceur suivi",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="card p-4 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-zinc-100 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3.5 bg-zinc-100 rounded w-3/5" />
          <div className="h-2.5 bg-zinc-100 rounded w-4/5" />
        </div>
      </div>
      <div className="flex justify-between pt-1 border-t border-zinc-100">
        <div className="h-2.5 bg-zinc-100 rounded w-1/4" />
        <div className="h-2.5 bg-zinc-100 rounded w-1/4" />
      </div>
      <div className="h-8 bg-zinc-100 rounded-lg" />
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
    : "Ajoutez des créateurs LinkedIn pour analyser leur style et générer du contenu inspiré.";

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-5">
        <Users size={24} className="text-brand-500" />
      </div>
      <h2 className="text-base font-semibold text-zinc-800 mb-2">{label}</h2>
      <p className="text-sm text-zinc-400 mb-7 max-w-xs leading-relaxed">{sub}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
      >
        <Plus size={15} />
        Ajouter un créateur
      </button>
    </div>
  );
}

// ─── KPI Section ──────────────────────────────────────────────────────────────

function KPISection({
  creators,
  insights,
}: {
  creators: CreatorWithCount[];
  insights: InsightData | null;
}) {
  const totalPosts   = creators.reduce((s, c) => s + c.post_count, 0);
  const activeSrc    = creators.filter((c) => c.post_count > 0).length;
  const topFormat    = insights?.best_formats[0];
  const topHook      = insights?.best_hooks[0];

  const kpis = [
    {
      label: "Créateurs suivis",
      value: creators.length,
      sub: `${activeSrc} actif${activeSrc !== 1 ? "s" : ""}`,
      icon: Users,
      color: "text-brand-500",
      bg: "bg-brand-50",
    },
    {
      label: "Posts analysés",
      value: totalPosts,
      sub: "au total",
      icon: FileText,
      color: "text-violet-500",
      bg: "bg-violet-50",
    },
    {
      label: "Format dominant",
      value: topFormat?.value ?? "—",
      sub: topFormat ? `${topFormat.percentage}% des posts` : "Scraper des créateurs",
      icon: Layout,
      color: "text-amber-500",
      bg: "bg-amber-50",
      capitalize: true,
    },
    {
      label: "Hook dominant",
      value: topHook?.value ?? "—",
      sub: topHook ? `${topHook.percentage}% des posts` : "Scraper des créateurs",
      icon: TrendingUp,
      color: "text-rose-500",
      bg: "bg-rose-50",
      capitalize: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="card p-5">
          <div className="flex items-start justify-between mb-4">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", kpi.bg)}>
              <kpi.icon size={15} className={kpi.color} />
            </div>
          </div>
          <p
            className={cn(
              "text-2xl font-semibold text-zinc-900 leading-none mb-1.5 truncate",
              kpi.capitalize && "capitalize"
            )}
          >
            {kpi.value}
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[11px] text-zinc-400 leading-none">{kpi.sub}</span>
          </div>
          <p className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide mt-3">
            {kpi.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChart({ items }: { items: InsightEntry[] }) {
  const max = Math.max(...items.map((i) => i.percentage), 1);

  return (
    <div className="space-y-4">
      {items.slice(0, 5).map((item, index) => (
        <div key={item.value}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-zinc-300 w-3 shrink-0">{index + 1}</span>
              <span className="text-sm text-zinc-700 capitalize truncate">{item.value}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[11px] text-zinc-400">{item.count}×</span>
              <span className="text-xs font-semibold text-zinc-500 w-9 text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-400 rounded-full transition-all duration-700"
              style={{ width: `${(item.percentage / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
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

  if (!hasData) {
    return (
      <div className="mt-8">
        <SectionLabel icon={Hash} title="Analyse du contenu" />
        <div className="card p-8 text-center mt-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto mb-3">
            <Hash size={18} className="text-zinc-300" />
          </div>
          <p className="text-sm text-zinc-400">
            Scrapez des créateurs pour voir les insights apparaître ici
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <SectionLabel icon={Hash} title="Analyse du contenu" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        {/* Top Hooks */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-4 rounded-full bg-brand-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Top Hooks
            </h3>
          </div>
          {data!.best_hooks.length > 0 ? (
            <BarChart items={data!.best_hooks} />
          ) : (
            <p className="text-sm text-zinc-400">Aucune donnée</p>
          )}
        </div>

        {/* Top Formats */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-4 rounded-full bg-violet-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Top Formats
            </h3>
          </div>
          {data!.best_formats.length > 0 ? (
            <BarChart items={data!.best_formats} />
          ) : (
            <p className="text-sm text-zinc-400">Aucune donnée</p>
          )}
        </div>

        {/* Top Themes */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-1.5 h-4 rounded-full bg-amber-400 shrink-0" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Top Thèmes
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data!.best_themes.slice(0, 8).map((theme, i) => {
              const weight = i < 2 ? "font-semibold text-zinc-700" : i < 4 ? "font-medium text-zinc-600" : "text-zinc-500";
              const size   = i < 2 ? "text-sm" : i < 4 ? "text-[13px]" : "text-xs";
              return (
                <span
                  key={theme.value}
                  className={cn(
                    "px-2.5 py-1 rounded-full bg-zinc-50 border border-zinc-200 cursor-default",
                    "hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 transition-colors",
                    weight,
                    size
                  )}
                >
                  {theme.value}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section label helper ─────────────────────────────────────────────────────

function SectionLabel({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={15} className="text-zinc-400" />
      <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
      <span className="flex-1 h-px bg-zinc-100" />
    </div>
  );
}

// ─── Cron section ─────────────────────────────────────────────────────────────

function CronSection({ logs }: { logs: CronLog[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pb-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-600 transition-colors"
      >
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
        Analyse automatique
      </button>

      {open && (
        <div className="mt-3 card overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <p className="text-xs text-zinc-400">Prochain scraping : demain à 8h00</p>
          </div>

          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-zinc-400">Aucune analyse automatique effectuée</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/30">
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Date</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Créateurs</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Posts</th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Erreurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {new Date(log.ran_at).toLocaleDateString("fr-FR", {
                        day:    "2-digit",
                        month:  "2-digit",
                        year:   "numeric",
                        hour:   "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-zinc-700 font-medium">
                      {log.creators_scraped}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right text-zinc-700 font-medium">
                      {log.posts_added}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-right">
                      <span
                        className={cn(
                          "font-medium",
                          Array.isArray(log.errors) && log.errors.length > 0
                            ? "text-red-500"
                            : "text-zinc-300"
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
  const [creators, setCreators]   = useState<CreatorWithCount[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [insights, setInsights]   = useState<InsightData | null>(null);
  const [cronLogs, setCronLogs]   = useState<CronLog[]>([]);
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
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, linkedin_url: linkedinUrl, category }),
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
    all:         creators.length,
    competitor:  creators.filter((c) => c.category === "competitor").length,
    top_creator: creators.filter((c) => c.category === "top_creator").length,
    influencer:  creators.filter((c) => c.category === "influencer").length,
  };

  const visible = activeTab
    ? creators.filter((c) => c.category === activeTab)
    : creators;

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Inspirations</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            {creators.length} créateur{creators.length !== 1 ? "s" : ""} suivis
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 hover:bg-white rounded-lg transition-all active:scale-[0.98]"
          >
            <PenSquare size={14} />
            Créer des posts
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-all active:scale-[0.98] shadow-sm"
          >
            <Plus size={14} />
            Ajouter un créateur
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <KPISection creators={creators} insights={insights} />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-0.5 mb-5 border-b border-zinc-200">
        {TABS.map((tab) => {
          const count  = tab.value === null ? tabCounts.all : tabCounts[tab.value];
          const active = activeTab === tab.value;

          return (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px",
                active
                  ? "text-brand-600 border-brand-500"
                  : "text-zinc-400 border-transparent hover:text-zinc-700 hover:border-zinc-300"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-[11px] font-semibold px-1.5 py-0.5 rounded-full",
                    active
                      ? "bg-brand-100 text-brand-600"
                      : "bg-zinc-100 text-zinc-400"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Creator grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
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
