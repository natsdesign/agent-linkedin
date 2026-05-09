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

type DailyReport = {
  id: string;
  date: string;
  new_posts_count: number;
  top_post_content: string | null;
  top_post_likes: number;
  top_creator: string | null;
  insights_summary: string | null;
  recommendations: string[] | null;
  created_at: string;
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
    <div className="rounded-[10px] p-4 flex flex-col gap-4 animate-pulse" style={{ background: "#1A1A1F", border: "1px solid #2A2A32" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full shrink-0" style={{ background: "#222228" }} />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 rounded w-3/5" style={{ background: "#222228" }} />
          <div className="h-2.5 rounded w-4/5" style={{ background: "#222228" }} />
        </div>
      </div>
      <div className="flex justify-between pt-2" style={{ borderTop: "1px solid #2A2A32" }}>
        <div className="h-2.5 rounded w-1/4" style={{ background: "#222228" }} />
        <div className="h-2.5 rounded w-1/4" style={{ background: "#222228" }} />
      </div>
      <div className="h-8 rounded-lg" style={{ background: "#222228" }} />
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
      <div
        className="w-12 h-12 rounded-[10px] flex items-center justify-center mb-4"
        style={{ background: "#0D2B22", border: "1px solid #064E3B" }}
      >
        <Users size={20} className="text-[#10B981]" />
      </div>
      <h2 className="text-sm font-semibold text-[#F0F0F5] mb-2">{label}</h2>
      <p className="text-sm text-[#8B8B9E] mb-7 max-w-xs leading-relaxed">{sub}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.98]"
        style={{ background: "#10B981", color: "#0F0F10" }}
      >
        <Plus size={14} />
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
  const totalPosts = creators.reduce((s, c) => s + c.post_count, 0);
  const activeSrc  = creators.filter((c) => c.post_count > 0).length;
  const topFormat  = insights?.best_formats[0];
  const topHook    = insights?.best_hooks[0];

  const kpis = [
    {
      label: "Créateurs suivis",
      value: creators.length,
      sub: `${activeSrc} actif${activeSrc !== 1 ? "s" : ""}`,
      icon: Users,
    },
    {
      label: "Posts analysés",
      value: totalPosts,
      sub: "au total",
      icon: FileText,
    },
    {
      label: "Format dominant",
      value: topFormat?.value ?? "—",
      sub: topFormat ? `${topFormat.percentage}% des posts` : "Scraper des créateurs",
      icon: Layout,
      capitalize: true,
    },
    {
      label: "Hook dominant",
      value: topHook?.value ?? "—",
      sub: topHook ? `${topHook.percentage}% des posts` : "Scraper des créateurs",
      icon: TrendingUp,
      capitalize: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="card">
          <p className="label-section mb-3">{kpi.label}</p>
          <p
            className={cn(
              "text-2xl font-bold text-[#F0F0F5] leading-none mb-1 font-mono truncate",
              kpi.capitalize && "capitalize"
            )}
          >
            {kpi.value}
          </p>
          <p className="text-[11px] text-[#55555F]">{kpi.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function InsightBar({ items }: { items: InsightEntry[] }) {
  const max = Math.max(...items.map((i) => i.percentage), 1);

  return (
    <div className="space-y-3">
      {items.slice(0, 5).map((item, index) => (
        <div key={item.value}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-mono text-[#55555F] w-3 shrink-0">{index + 1}</span>
              <span className="text-sm text-[#F0F0F5] capitalize truncate">{item.value}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[11px] text-[#55555F]">{item.count}×</span>
              <span className="text-xs font-semibold text-[#8B8B9E] w-9 text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "#222228" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(item.percentage / max) * 100}%`, background: "#10B981" }}
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
        <p className="label-section mb-4 flex items-center gap-2">
          <Hash size={12} />
          Analyse du contenu
        </p>
        <div className="card text-center py-10">
          <Hash size={18} className="text-[#55555F] mx-auto mb-3" />
          <p className="text-sm text-[#55555F]">
            Scrapez des créateurs pour voir les insights apparaître ici
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="label-section mb-4 flex items-center gap-2">
        <Hash size={12} />
        Analyse du contenu
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top Hooks */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: "#10B981" }} />
            <h3 className="label-section">Top Hooks</h3>
          </div>
          {data!.best_hooks.length > 0 ? (
            <InsightBar items={data!.best_hooks} />
          ) : (
            <p className="text-sm text-[#55555F]">Aucune donnée</p>
          )}
        </div>

        {/* Top Formats */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: "#34D399" }} />
            <h3 className="label-section">Top Formats</h3>
          </div>
          {data!.best_formats.length > 0 ? (
            <InsightBar items={data!.best_formats} />
          ) : (
            <p className="text-sm text-[#55555F]">Aucune donnée</p>
          )}
        </div>

        {/* Top Thèmes */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1 h-4 rounded-full shrink-0" style={{ background: "#F59E0B" }} />
            <h3 className="label-section">Top Thèmes</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data!.best_themes.slice(0, 8).map((theme, i) => {
              const opacity = i < 2 ? "text-[#F0F0F5] font-semibold" : i < 4 ? "text-[#8B8B9E] font-medium" : "text-[#55555F]";
              const size    = i < 2 ? "text-sm" : i < 4 ? "text-[13px]" : "text-xs";
              return (
                <span
                  key={theme.value}
                  className={cn(
                    "px-2.5 py-1 rounded-md cursor-default transition-colors",
                    "hover:text-[#10B981]",
                    opacity,
                    size
                  )}
                  style={{ background: "#222228", border: "1px solid #2A2A32" }}
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

// ─── Cron section ─────────────────────────────────────────────────────────────

function CronSection({ logs, dailyReports }: { logs: CronLog[]; dailyReports: DailyReport[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 pb-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-[#55555F] hover:text-[#8B8B9E] transition-colors"
      >
        <ChevronDown
          size={13}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
        Analyse automatique
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Cron logs table */}
          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #2A2A32" }}>
            <div className="px-4 py-3" style={{ background: "#1A1A1F", borderBottom: "1px solid #2A2A32" }}>
              <p className="text-xs text-[#55555F]">Prochain scraping : demain à 8h00 — max 5 posts/créateur</p>
            </div>

            {logs.length === 0 ? (
              <div className="px-4 py-8 text-center" style={{ background: "#111115" }}>
                <p className="text-sm text-[#55555F]">Aucune analyse automatique effectuée</p>
              </div>
            ) : (
              <table className="w-full" style={{ background: "#111115" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2A2A32" }}>
                    {["Date", "Créateurs", "Posts", "Erreurs"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#55555F]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors" style={{ borderBottom: "1px solid #1E1E26" }}>
                      <td className="px-4 py-2.5 text-xs text-[#8B8B9E]">
                        {new Date(log.ran_at).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right text-[#F0F0F5] font-medium">{log.creators_scraped}</td>
                      <td className="px-4 py-2.5 text-xs text-right text-[#F0F0F5] font-medium">{log.posts_added}</td>
                      <td className="px-4 py-2.5 text-xs text-right">
                        <span
                          className="font-medium"
                          style={{
                            color: Array.isArray(log.errors) && log.errors.length > 0 ? "#EF4444" : "#55555F",
                          }}
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

          {/* Daily reports */}
          {dailyReports.length > 0 && (
            <div className="space-y-3">
              <p className="label-section px-1">Rapports quotidiens</p>
              {dailyReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-[10px]"
                  style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderLeft: "3px solid #10B981" }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="text-sm font-semibold text-[#F0F0F5]">
                        {new Date(report.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-[#55555F] mt-0.5">
                        {report.new_posts_count} nouveau{report.new_posts_count > 1 ? "x" : ""} post{report.new_posts_count > 1 ? "s" : ""}
                        {report.top_creator ? ` · Top : ${report.top_creator} (${report.top_post_likes} likes)` : ""}
                      </p>
                    </div>
                  </div>
                  {report.insights_summary && (
                    <p className="text-xs text-[#8B8B9E] leading-relaxed mb-3">{report.insights_summary}</p>
                  )}
                  {report.recommendations && report.recommendations.length > 0 && (
                    <ul className="space-y-1">
                      {report.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#8B8B9E]">
                          <span className="text-[#10B981] font-bold shrink-0">→</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
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
  const [cronLogs, setCronLogs]       = useState<CronLog[]>([]);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const { showToast } = useToast();

  async function fetchCreators() {
    const res = await fetch("/api/creators");
    if (res.ok) setCreators(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchCreators();
    fetch("/api/insights").then((r) => (r.ok ? r.json() : null)).then(setInsights).catch(() => {});
    fetch("/api/cron/logs").then((r) => (r.ok ? r.json() : [])).then(setCronLogs).catch(() => {});
    fetch("/api/daily-reports").then((r) => (r.ok ? r.json() : [])).then(setDailyReports).catch(() => {});
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

  function handleScrapeDone(id: string, update: { last_scraped_at: string | null; post_count: number; avatar_url: string | null }) {
    setCreators((prev) => prev.map((c) => c.id === id ? { ...c, ...update } : c));
    fetch("/api/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setInsights(data); })
      .catch(() => {});
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
          <h1 className="text-2xl font-semibold text-[#F0F0F5] tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            Inspirations
          </h1>
          <p className="text-sm text-[#55555F] mt-0.5">
            {creators.length} créateur{creators.length !== 1 ? "s" : ""} suivis
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/create"
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#8B8B9E] hover:text-[#F0F0F5] rounded-lg transition-all active:scale-[0.98]"
            style={{ border: "1px solid #2A2A32" }}
          >
            <PenSquare size={13} />
            Créer des posts
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition-all active:scale-[0.98]"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            <Plus size={13} />
            Ajouter un créateur
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && <KPISection creators={creators} insights={insights} />}

      {/* Tabs — style underline */}
      <div className="flex items-center gap-0.5 mb-6" style={{ borderBottom: "1px solid #2A2A32" }}>
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
                  ? "text-[#F0F0F5] border-[#10B981]"
                  : "text-[#55555F] border-transparent hover:text-[#8B8B9E]"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={
                    active
                      ? { background: "#064E3B", color: "#10B981" }
                      : { background: "#1A1A1F", color: "#55555F" }
                  }
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
            <CreatorCard
              key={creator.id}
              creator={creator}
              onDelete={handleDelete}
              onScrapeDone={(update) => handleScrapeDone(creator.id, update)}
            />
          ))}
        </div>
      ) : (
        <EmptyState tab={activeTab} onAdd={() => setModalOpen(true)} />
      )}

      {/* Insights */}
      <InsightsSection data={insights} />

      {/* Cron */}
      <CronSection logs={cronLogs} dailyReports={dailyReports} />

      <AddCreatorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}
