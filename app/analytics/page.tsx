"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Trash2, Plus, Download, Brain, X } from "lucide-react";
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
  // Start from 52 weeks ago, aligned to Sunday
  const start = new Date(today);
  start.setDate(today.getDate() - WEEKS * 7);
  start.setDate(start.getDate() - start.getDay());

  // Build map: dateStr → engagement_rate
  const postMap: Record<string, { engagement: number; likes: number; content: string }> = {};
  posts.forEach((p) => {
    if (!p.published_at) return;
    const d = p.published_at.slice(0, 10);
    postMap[d] = {
      engagement: p.engagement_rate ?? 0,
      likes: p.likes,
      content: p.content.slice(0, 80),
    };
  });

  // Top 20% threshold
  const engagements = posts
    .map((p) => p.engagement_rate ?? 0)
    .filter((e) => e > 0)
    .sort((a, b) => a - b);
  const viralThreshold =
    engagements.length > 0
      ? engagements[Math.floor(engagements.length * 0.8)]
      : Infinity;

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

  const [tooltip, setTooltip] = useState<{
    x: number; y: number; date: string; info: typeof postMap[string] | null
  } | null>(null);

  return (
    <div className="relative overflow-x-auto">
      <svg
        width={WEEKS * (CELL + GAP)}
        height={DAYS * (CELL + GAP) + 20}
        className="block"
      >
        {cells.map((c) => {
          let fill = "#e5e7eb"; // gray-200 — pas de post
          if (c.info) {
            fill = c.info.engagement >= viralThreshold ? "#16a34a" : "#86efac"; // green-600 / green-300
          }
          return (
            <rect
              key={c.date}
              x={c.x * (CELL + GAP)}
              y={c.y * (CELL + GAP) + 16}
              width={CELL}
              height={CELL}
              rx={2}
              fill={fill}
              className="cursor-pointer"
              onMouseEnter={(e) => setTooltip({ ...c, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </svg>

      {tooltip && (
        <div
          className="fixed z-50 bg-zinc-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg max-w-[220px] pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          <div className="font-medium">{tooltip.date}</div>
          {tooltip.info ? (
            <>
              <div>{tooltip.info.likes} likes • {tooltip.info.engagement.toFixed(1)}% engagement</div>
              <div className="mt-1 text-zinc-300 leading-snug">{tooltip.info.content}…</div>
            </>
          ) : (
            <div className="text-zinc-400">Pas de post ce jour-là</div>
          )}
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
  const [form, setForm] = useState({
    content: "", published_at: "", likes: "", comments: "", views: "", post_url: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/my-posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: form.content,
        published_at: form.published_at || null,
        likes: parseInt(form.likes) || 0,
        comments: parseInt(form.comments) || 0,
        views: parseInt(form.views) || 0,
        post_url: form.post_url || null,
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
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Contenu *</label>
            <textarea
              required
              rows={5}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Date de publication</label>
              <input
                type="date"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.published_at}
                onChange={(e) => setForm({ ...form, published_at: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Vues</label>
              <input
                type="number" min="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.views}
                onChange={(e) => setForm({ ...form, views: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Likes</label>
              <input
                type="number" min="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.likes}
                onChange={(e) => setForm({ ...form, likes: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Commentaires</label>
              <input
                type="number" min="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">URL du post (optionnel)</label>
            <input
              type="url"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.post_url}
              onChange={(e) => setForm({ ...form, post_url: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
              Annuler
            </button>
            <button
              type="submit" disabled={saving}
              className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal URL LinkedIn ───────────────────────────────────────────────────────

function LinkedInUrlModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: profile } = await fetch("/api/profile").then((r) => r.json()).then((d) => ({ data: d }));
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...profile, linkedin_url: url }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-semibold text-zinc-900 mb-4">URL de ton profil LinkedIn</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url" required
            placeholder="https://www.linkedin.com/in/ton-profil"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600">Annuler</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    const data = await fetch("/api/my-posts").then((r) => r.json());
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function handleImport() {
    setImportError(null);
    setImporting(true);
    const res = await fetch("/api/my-posts/import", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      if (data.error?.includes("URL LinkedIn")) {
        setShowLinkedInModal(true);
      } else {
        setImportError(data.error ?? "Erreur lors de l'import.");
      }
    } else {
      await loadPosts();
    }
    setImporting(false);
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    const res = await fetch("/api/my-posts/analyze", { method: "POST" });
    const data = await res.json();
    if (res.ok) setAnalysis(data);
    setAnalyzing(false);
  }

  async function handleDelete(id: string) {
    setPosts((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/my-posts/${id}`, { method: "DELETE" });
  }

  // ── KPIs ──
  const postsWithEngagement = posts.filter((p) => (p.engagement_rate ?? 0) > 0);
  const avgEngagement =
    postsWithEngagement.length > 0
      ? postsWithEngagement.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / postsWithEngagement.length
      : 0;
  const bestPost = posts.reduce<MyPost | null>(
    (best, p) => (!best || p.likes > best.likes ? p : best),
    null
  );

  // Streak: consecutive days with a post up to today
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
    .filter((p) => p.published_at && p.engagement_rate != null)
    .sort((a, b) => (a.published_at! > b.published_at! ? 1 : -1))
    .map((p) => ({
      date: p.published_at!.slice(0, 10),
      engagement: Number((p.engagement_rate ?? 0).toFixed(2)),
      content: p.content.slice(0, 60),
    }));

  const formatMap: Record<string, { total: number; count: number }> = {};
  posts.forEach((p) => {
    if (!p.format) return;
    if (!formatMap[p.format]) formatMap[p.format] = { total: 0, count: 0 };
    formatMap[p.format].total += p.engagement_rate ?? 0;
    formatMap[p.format].count += 1;
  });
  const barData = Object.entries(formatMap).map(([format, { total, count }]) => ({
    format,
    avg: Number((total / count).toFixed(2)),
  }));

  const FORMAT_COLORS: Record<string, string> = {
    liste: "#10b981",
    texte: "#6366f1",
    storytelling: "#f59e0b",
    carrousel: "#ef4444",
    court: "#8b5cf6",
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Mon compte</h1>
            <p className="text-zinc-500 text-sm mt-1">Suivi de tes performances LinkedIn personnelles</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-sm font-medium text-zinc-700 rounded-lg hover:bg-zinc-50 disabled:opacity-50"
            >
              <Download size={15} />
              {importing ? "Import en cours…" : "Importer depuis LinkedIn"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600"
            >
              <Plus size={15} />
              Ajouter un post
            </button>
          </div>
        </div>

        {importError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {importError}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Engagement moyen",
              value: `${avgEngagement.toFixed(2)}%`,
              sub: `sur ${postsWithEngagement.length} posts avec vues`,
            },
            {
              label: "Meilleur post",
              value: bestPost ? `${bestPost.likes} likes` : "—",
              sub: bestPost?.content.slice(0, 40) + (bestPost ? "…" : ""),
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
              <h2 className="font-semibold text-zinc-900 mb-5">Évolution de l'engagement</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Engagement"]}
                    labelFormatter={(l) => `Le ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Line
                    type="monotone" dataKey="engagement"
                    stroke="#10b981" strokeWidth={2}
                    dot={{ r: 3, fill: "#10b981" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            {barData.length > 0 && (
              <div className="bg-white rounded-xl border border-zinc-100 p-6 shadow-sm">
                <h2 className="font-semibold text-zinc-900 mb-5">Engagement moyen par format</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="format" tick={{ fontSize: 12 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, "Engagement moyen"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell
                          key={entry.format}
                          fill={FORMAT_COLORS[entry.format] ?? "#6366f1"}
                        />
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

          {analysis && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Meilleur jour", value: analysis.best_day },
                  { label: "Meilleur format", value: analysis.best_format },
                  { label: "Meilleur hook", value: analysis.best_hook },
                  { label: "Engagement moyen IA", value: `${analysis.avg_engagement}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                    <div className="text-xs text-emerald-600 font-medium mb-1">{label}</div>
                    <div className="font-semibold text-zinc-900 capitalize">{value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Observations</h3>
                  <ul className="space-y-2">
                    {analysis.insights.map((ins, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        {ins}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 mb-3">Recommandations</h3>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                        <span className="mt-0.5 text-emerald-500">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {!analysis && (
            <p className="text-sm text-zinc-400">
              Lance l'analyse pour obtenir des recommandations personnalisées basées sur tes posts.
            </p>
          )}
        </div>

        {/* Table */}
        {posts.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100">
              <h2 className="font-semibold text-zinc-900">Tous tes posts</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  {["Date", "Contenu", "Format", "Likes", "Comments", "Engagement", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {p.published_at?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 max-w-[260px]">
                      <span className="line-clamp-2">{p.content}</span>
                    </td>
                    <td className="px-4 py-3">
                      {p.format ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{p.format}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{p.likes}</td>
                    <td className="px-4 py-3 text-zinc-700">{p.comments}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {p.engagement_rate != null ? `${Number(p.engagement_rate).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-zinc-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {posts.length === 0 && (
          <div className="bg-white rounded-xl border border-zinc-100 p-12 text-center shadow-sm">
            <div className="text-zinc-300 text-4xl mb-3">📊</div>
            <div className="text-zinc-500 text-sm">Aucun post suivi pour l'instant.</div>
            <div className="text-zinc-400 text-xs mt-1">Ajoute des posts manuellement ou importe depuis LinkedIn.</div>
          </div>
        )}
      </div>

      {showAdd && <AddPostModal onClose={() => setShowAdd(false)} onAdded={loadPosts} />}
      {showLinkedInModal && (
        <LinkedInUrlModal
          onClose={() => setShowLinkedInModal(false)}
          onSaved={() => { setShowLinkedInModal(false); handleImport(); }}
        />
      )}
    </div>
  );
}
