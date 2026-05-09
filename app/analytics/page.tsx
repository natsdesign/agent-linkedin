"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Trash2, Plus, Download, Brain, X, Link2, Link2Off, RefreshCw } from "lucide-react";
import { MyPost } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisResult = {
  best_day: string;
  best_format: string;
  best_hook: string;
  avg_engagement: number;
  insights: string[];
  recommendations: string[];
};

// ─── Heatmap (SVG natif, style GitHub) ────────────────────────────────────────

function Heatmap({ posts }: { posts: MyPost[] }) {
  const CELL = 11;
  const GAP = 2;
  const WEEKS = 52;
  const DAYS = 7;

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - WEEKS * 7);
  start.setDate(start.getDate() - start.getDay());

  const postMap: Record<string, { score: number; likes: number; content: string }> = {};
  posts.forEach((p) => {
    if (!p.published_at) return;
    const d = p.published_at.slice(0, 10);
    const score = Math.min(100, (p.likes ?? 0) * 2 + (p.comments ?? 0) * 5 + (p.shares ?? 0) * 3);
    postMap[d] = { score, likes: p.likes, content: p.content.slice(0, 80) };
  });

  const scores = posts.map((p) => Math.min(100, (p.likes ?? 0) * 2 + (p.comments ?? 0) * 5 + (p.shares ?? 0) * 3)).filter((s) => s > 0).sort((a, b) => a - b);
  const viralThreshold = scores.length > 0 ? scores[Math.floor(scores.length * 0.8)] : Infinity;

  const cells: { x: number; y: number; date: string; info: typeof postMap[string] | null }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < DAYS; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w * 7 + d);
      if (cur > today) continue;
      const dateStr = cur.toISOString().slice(0, 10);
      cells.push({ x: w, y: d, date: dateStr, info: postMap[dateStr] ?? null });
    }
  }

  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; info: typeof postMap[string] | null } | null>(null);

  return (
    <div className="relative overflow-x-auto">
      <svg width={WEEKS * (CELL + GAP)} height={DAYS * (CELL + GAP) + 20} className="block">
        {cells.map((c) => {
          let fill = "#e5e7eb";
          if (c.info) fill = c.info.score >= viralThreshold ? "#16a34a" : "#86efac";
          return (
            <rect
              key={c.date}
              x={c.x * (CELL + GAP)} y={c.y * (CELL + GAP) + 16}
              width={CELL} height={CELL} rx={2} fill={fill}
              className="cursor-pointer"
              onMouseEnter={(e) => setTooltip({ ...c, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>
      {tooltip && (
        <div className="fixed z-50 bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-[220px] pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}>
          <div className="font-medium">{tooltip.date}</div>
          {tooltip.info ? (
            <>
              <div>{tooltip.info.likes} likes • score {tooltip.info.score} / 100</div>
              <div className="mt-1 text-zinc-300 leading-snug">{tooltip.info.content}…</div>
            </>
          ) : <div className="text-zinc-400">Pas de post ce jour-là</div>}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
        <span>Moins</span>
        {["#e5e7eb", "#86efac", "#16a34a"].map((c) => (
          <span key={c} className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
        ))}
        <span>Plus</span>
      </div>
    </div>
  );
}

// ─── Modal ajout post ─────────────────────────────────────────────────────────

function AddPostModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ content: "", published_at: "", likes: "", comments: "", views: "", post_url: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/my-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: form.content, published_at: form.published_at || null,
        likes: parseInt(form.likes) || 0, comments: parseInt(form.comments) || 0,
        views: parseInt(form.views) || 0, post_url: form.post_url || null,
      }),
    });
    setSaving(false);
    onAdded();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Ajouter un post</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Contenu *</label>
            <textarea required rows={5} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Date de publication", key: "published_at", type: "date" },
              { label: "Vues", key: "views", type: "number" },
              { label: "Likes", key: "likes", type: "number" },
              { label: "Commentaires", key: "comments", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
                <input type={type} min={type === "number" ? "0" : undefined} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">URL du post (optionnel)</label>
            <input type="url" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" value={form.post_url} onChange={(e) => setForm({ ...form, post_url: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Annuler</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {saving ? "Enregistrement…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal lier compte LinkedIn ───────────────────────────────────────────────

function LinkedInUrlModal({ onClose, onSaved }: { onClose: () => void; onSaved: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const profileData = await fetch("/api/profile").then((r) => r.json());
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profileData, linkedin_url: url }),
    });
    setSaving(false);
    onSaved(url);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-zinc-900 mb-1">Lier mon compte LinkedIn</h2>
        <p className="text-sm text-zinc-400 mb-4">Renseigne l'URL de ton profil pour importer tes posts automatiquement.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="url" required placeholder="https://www.linkedin.com/in/ton-profil" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {saving ? "Enregistrement…" : "Lier le compte"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal délier compte ──────────────────────────────────────────────────────

function UnlinkModal({ linkedinUrl, onClose, onUnlinked }: { linkedinUrl: string; onClose: () => void; onUnlinked: () => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const slug = linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "");

  async function handleConfirm() {
    if (input !== "CONFIRMER") return;
    setLoading(true);
    await fetch("/api/my-posts/unlink", { method: "POST" });
    setLoading(false);
    onUnlinked();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-zinc-900 mb-2">Délier le compte</h2>
        <p className="text-sm text-zinc-500 mb-4">Es-tu sûr ? Cette action supprime tous tes posts importés.</p>
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 text-sm text-red-700">
          Compte à délier : <strong>linkedin.com/in/{slug}</strong>
        </div>
        <p className="text-sm text-zinc-600 mb-2">Tape <strong>CONFIRMER</strong> pour continuer :</p>
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="CONFIRMER"
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-300"
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600">Annuler</button>
          <button
            onClick={handleConfirm}
            disabled={input !== "CONFIRMER" || loading}
            className="px-5 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {loading ? "Déliaison…" : "Délier et supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [budgetExceeded, setBudgetExceeded] = useState(false);

  const loadData = useCallback(async () => {
    const [postsData, profileData] = await Promise.all([
      fetch("/api/my-posts").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ]);
    setPosts(Array.isArray(postsData) ? postsData : []);
    setLinkedinUrl(profileData?.linkedin_url || null);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleImport() {
    setImportMsg(null);
    setImporting(true);
    const res = await fetch("/api/my-posts/import", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setImportMsg(data.error ?? "Erreur lors de l'import.");
    } else {
      setImportMsg(`${data.imported} post${data.imported !== 1 ? "s" : ""} importé${data.imported !== 1 ? "s" : ""}, ${data.skipped} ignoré${data.skipped !== 1 ? "s" : ""}.`);
      await loadData();
    }
    setImporting(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    const res = await fetch("/api/my-posts/analyze", { method: "POST" });
    const data = await res.json();
    if (!res.ok && data?.error === "budget_exceeded") {
      setBudgetExceeded(true);
    } else if (res.ok) {
      setAnalysis(data);
    }
    setAnalyzing(false);
  }

  async function handleDelete(id: string) {
    setPosts((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/my-posts/${id}`, { method: "DELETE" });
  }

  // ── KPIs ──
  const noViews = posts.every((p) => !p.views || p.views === 0);
  const allEngagementZero = posts.every((p) => !p.engagement_rate || p.engagement_rate === 0);

  // Score 0-100 : likes×2 + comments×5 + shares×3, plafonné à 100
  const postScore = (p: MyPost) => Math.min(100, (p.likes ?? 0) * 2 + (p.comments ?? 0) * 5 + (p.shares ?? 0) * 3);

  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + postScore(p), 0) / posts.length)
    : 0;

  const postsWithEngagement = posts.filter((p) => (p.engagement_rate ?? 0) > 0);
  const avgEngagement = (() => {
    if (postsWithEngagement.length > 0) {
      return postsWithEngagement.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsWithEngagement.length;
    }
    const withLikes = posts.filter((p) => p.likes > 0);
    if (withLikes.length > 0) {
      return withLikes.reduce((s, p) => s + p.likes, 0) / withLikes.length / 100;
    }
    return 0;
  })();

  const bestPost = posts.reduce<MyPost | null>((best, p) => (!best || postScore(p) > postScore(best) ? p : best), null);

  const postDays = new Set(posts.map((p) => p.published_at?.slice(0, 10)).filter(Boolean));
  let streak = 0;
  const cur = new Date();
  while (true) {
    const d = cur.toISOString().slice(0, 10);
    if (!postDays.has(d)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  // ── Chart data ──
  const lineData = posts
    .filter((p) => p.published_at)
    .sort((a, b) => (a.published_at! > b.published_at! ? 1 : -1))
    .slice(-30)
    .map((p) => ({
      date:  p.published_at!.slice(0, 10),
      value: postScore(p),
    }));

  const formatMap: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    if (!p.format) return;
    if (!formatMap[p.format]) formatMap[p.format] = { total: 0, count: 0 };
    formatMap[p.format].total += postScore(p);
    formatMap[p.format].count += 1;
  });
  const barData = Object.entries(formatMap).map(([format, { total, count }]) => ({
    format, avg: Math.round(total / count),
  }));

  const FORMAT_COLORS: Record<string, string> = {
    liste: "#10b981", texte: "#6366f1", storytelling: "#f59e0b", carrousel: "#ef4444", court: "#8b5cf6",
  };

  const linkedinSlug = linkedinUrl
    ? linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "")
    : null;

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">Chargement…</div>;
  }

  // ── État non lié ───────────────────────────────────────────────────────────
  if (!linkedinUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 p-8">
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm p-10 text-center max-w-md w-full">
          <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Link2 size={24} className="text-zinc-400" />
          </div>
          <h2 className="text-lg font-semibold text-zinc-900 mb-2">Aucun compte lié</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Lie ton profil LinkedIn pour importer tes posts et suivre tes performances automatiquement.
          </p>
          <button
            onClick={() => setShowLink(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 mx-auto"
          >
            <Link2 size={15} />
            Lier mon compte LinkedIn
          </button>
          <div className="mt-6 pt-6 border-t border-zinc-100">
            <p className="text-xs text-zinc-400 mb-3">Ou ajoute des posts manuellement</p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-sm font-medium text-zinc-600 rounded-lg hover:bg-zinc-50 mx-auto"
            >
              <Plus size={14} />
              Ajouter un post
            </button>
          </div>
        </div>

        {showLink && (
          <LinkedInUrlModal
            onClose={() => setShowLink(false)}
            onSaved={(url) => { setLinkedinUrl(url); setShowLink(false); handleImport(); }}
          />
        )}
        {showAdd && <AddPostModal onClose={() => setShowAdd(false)} onAdded={loadData} />}
      </div>
    );
  }

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthLabel = nextMonth.toLocaleDateString("fr-FR", { month: "long" });

  // ── État lié ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Budget exceeded banner */}
        {budgetExceeded && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            <span>⚠️</span>
            <span>Budget mensuel atteint. Prochain reset : 1er {nextMonthLabel}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Mon compte</h1>
            <p className="text-zinc-500 text-sm mt-1">Suivi de tes performances LinkedIn personnelles</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
          >
            <Plus size={15} />
            Ajouter un post
          </button>
        </div>

        {/* Bannière compte lié */}
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
            <Link2 size={15} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800">Compte lié</p>
            <p className="text-xs text-emerald-600 truncate">linkedin.com/in/{linkedinSlug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={importing ? "animate-spin" : ""} />
              {importing ? "Import…" : "↻ Mettre à jour"}
            </button>
            <button
              onClick={() => setShowUnlink(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-zinc-500 hover:text-red-600 border border-zinc-200 hover:border-red-200 text-xs font-medium rounded-lg transition-colors"
            >
              <Link2Off size={12} />
              Délier
            </button>
          </div>
        </div>

        {importMsg && (
          <div className={`text-sm rounded-lg px-4 py-3 ${importMsg.includes("Erreur") ? "bg-red-50 border border-red-200 text-red-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
            {importMsg}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Score moyen",
              value: `${avgScore} / 100`,
              sub: "likes×2 + comments×5 + shares×3",
            },
            {
              label: "Meilleur post",
              value: bestPost ? `${postScore(bestPost)} / 100` : "—",
              sub: bestPost ? bestPost.content.slice(0, 40) + "…" : "Aucun post",
            },
            {
              label: "Posts suivis",
              value: posts.length.toString(),
              sub: "dans ta bibliothèque",
            },
            {
              label: "Streak actuel",
              value: `${streak} jour${streak !== 1 ? "s" : ""}`,
              sub: "consécutifs avec un post",
            },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-xl border border-zinc-100 p-5 shadow-sm">
              <div className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-2">{label}</div>
              <div className="text-2xl font-bold text-zinc-900">{value}</div>
              <div className="text-xs text-zinc-400 mt-1 leading-snug">{sub}</div>
            </div>
          ))}
        </div>

        {posts.length > 0 && (
          <>
            {/* Line chart */}
            <div className="bg-white rounded-xl border border-zinc-100 p-6 shadow-sm">
              <h2 className="font-semibold text-zinc-900 mb-1">Évolution du score</h2>
              <p className="text-xs text-zinc-400 mb-4">Score 0-100 par post (likes×2 + comments×5 + shares×3)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    formatter={(v) => [`${Number(v ?? 0)} / 100`, "Score"]}
                    labelFormatter={(l) => `Le ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            {barData.length > 0 && (
              <div className="bg-white rounded-xl border border-zinc-100 p-6 shadow-sm">
                <h2 className="font-semibold text-zinc-900 mb-5">Score moyen par format</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="format" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      formatter={(v) => [`${Number(v ?? 0)} / 100`, "Score moyen"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell key={entry.format} fill={FORMAT_COLORS[entry.format] ?? "#6366f1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Heatmap */}
            <div className="bg-white rounded-xl border border-zinc-100 p-6 shadow-sm">
              <h2 className="font-semibold text-zinc-900 mb-5">Heatmap d'activité</h2>
              <Heatmap posts={posts} />
            </div>
          </>
        )}

        {/* Analyse IA */}
        <div className="bg-white rounded-xl border border-zinc-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-zinc-900">Insights personnels IA</h2>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || posts.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              <Brain size={15} />
              {analyzing ? "Analyse en cours…" : "Analyser mes performances"}
            </button>
          </div>

          {analysis ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Ce qui marche */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <h3 className="font-semibold text-emerald-800 mb-3 text-sm">💪 Ce qui marche</h3>
                <div className="space-y-1.5 text-sm">
                  <p className="text-emerald-700">Format : <strong className="capitalize">{analysis.best_format}</strong></p>
                  <p className="text-emerald-700">Hook : <strong className="capitalize">{analysis.best_hook}</strong></p>
                </div>
                {analysis.insights.slice(0, Math.ceil(analysis.insights.length / 2)).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {analysis.insights.slice(0, Math.ceil(analysis.insights.length / 2)).map((ins, i) => (
                      <li key={i} className="text-xs text-emerald-700 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">✓</span>{ins}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ce qui ne marche pas */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <h3 className="font-semibold text-amber-800 mb-3 text-sm">⚠️ Points d&apos;amélioration</h3>
                {analysis.insights.slice(Math.ceil(analysis.insights.length / 2)).length > 0 ? (
                  <ul className="space-y-1.5">
                    {analysis.insights.slice(Math.ceil(analysis.insights.length / 2)).map((ins, i) => (
                      <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">•</span>{ins}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-amber-600">Continue à analyser plus de posts pour voir les points faibles.</p>
                )}
              </div>

              {/* Meilleur moment */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3 text-sm">📅 Meilleur moment pour poster</h3>
                <p className="text-xl font-bold text-blue-900 capitalize">{analysis.best_day}</p>
                <p className="text-xs text-blue-600 mt-1">Engagement moyen estimé : {analysis.avg_engagement}%</p>
              </div>

              {/* 3 recommandations */}
              <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                <h3 className="font-semibold text-brand-800 mb-3 text-sm">💡 3 recommandations concrètes</h3>
                <ul className="space-y-2">
                  {analysis.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-brand-700">
                      <span className="font-bold shrink-0 mt-0.5">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Lance l&apos;analyse pour obtenir des recommandations personnalisées basées sur tes posts.</p>
          )}
        </div>

        {/* Table */}
        {posts.length > 0 ? (
          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Tous tes posts</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Date", "Contenu", "Format", "Likes", "Comments", "Score /100", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">{p.published_at?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-700 max-w-[260px]"><span className="line-clamp-2">{p.content}</span></td>
                    <td className="px-4 py-3">
                      {p.format ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{p.format}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{p.likes}</td>
                    <td className="px-4 py-3 text-zinc-700">{p.comments}</td>
                    <td className="px-4 py-3 text-zinc-700 font-medium">{postScore(p)} / 100</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(p.id)} className="text-zinc-300 hover:text-red-400 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-zinc-100 p-12 text-center shadow-sm">
            <div className="text-zinc-300 text-4xl mb-3">📊</div>
            <div className="text-zinc-500 text-sm">Aucun post suivi pour l'instant.</div>
            <div className="text-zinc-400 text-xs mt-1">Clique sur "↻ Mettre à jour" pour importer tes derniers posts LinkedIn.</div>
          </div>
        )}
      </div>

      {showAdd && <AddPostModal onClose={() => setShowAdd(false)} onAdded={loadData} />}
      {showUnlink && (
        <UnlinkModal
          linkedinUrl={linkedinUrl}
          onClose={() => setShowUnlink(false)}
          onUnlinked={() => { setPosts([]); setLinkedinUrl(null); }}
        />
      )}
    </div>
  );
}
