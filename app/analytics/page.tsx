"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Trash2, Plus, Brain, X, Link2, Link2Off, RefreshCw, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { MyPost } from "@/types";
import type { CoachReport, CoachPredictionDB, CoachKnowledge } from "@/lib/coach";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalysisResult = {
  best_day: string;
  best_format: string;
  best_hook: string;
  avg_engagement: number;
  insights: string[];
  recommendations: string[];
};

// ─── Score helpers ─────────────────────────────────────────────────────────────

function calcRaw(p: { likes: number; comments: number; shares: number }): number {
  return p.likes * 2 + p.comments * 5 + (p.shares ?? 0) * 3;
}

function calcScore(raw: number, maxRaw: number): number {
  if (maxRaw === 0) return 0;
  return Math.round((raw / maxRaw) * 100);
}

function scoreLabel(score: number): { text: string; bg: string; color: string } {
  if (score >= 75) return { text: "🔥 Viral",   bg: "#450A0A", color: "#EF4444" };
  if (score >= 50) return { text: "⚡ Fort",    bg: "#451A03", color: "#F59E0B" };
  if (score >= 25) return { text: "👍 Correct", bg: "#064E3B", color: "#10B981" };
  return                   { text: "📉 Faible",  bg: "#1A1A1F", color: "#8B8B9E" };
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ posts }: { posts: MyPost[] }) {
  const CELL = 11;
  const GAP  = 2;
  const WEEKS = 52;
  const DAYS  = 7;

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - WEEKS * 7);
  start.setDate(start.getDate() - start.getDay());

  const maxRaw = posts.length > 0 ? Math.max(...posts.map((p) => calcRaw(p))) : 0;

  const postMap: Record<string, { score: number; likes: number; comments: number; content: string }> = {};
  posts.forEach((p) => {
    if (!p.published_at) return;
    const d = p.published_at.slice(0, 10);
    postMap[d] = {
      score: calcScore(calcRaw(p), maxRaw),
      likes: p.likes,
      comments: p.comments,
      content: p.content.slice(0, 80),
    };
  });

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

  function cellFill(info: typeof postMap[string] | null): string {
    if (!info) return "#1A1A1F";
    if (info.score >= 75) return "#34D399";
    if (info.score >= 50) return "#10B981";
    if (info.score >= 25) return "#059669";
    return "#064E3B";
  }

  return (
    <div className="relative overflow-x-auto">
      <svg width={WEEKS * (CELL + GAP)} height={DAYS * (CELL + GAP) + 20} className="block">
        {cells.map((c) => (
          <rect
            key={c.date}
            x={c.x * (CELL + GAP)} y={c.y * (CELL + GAP) + 16}
            width={CELL} height={CELL} rx={2}
            fill={cellFill(c.info)}
            className="cursor-pointer"
            onMouseEnter={(e) => setTooltip({ ...c, x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>
      {tooltip && (
        <div
          className="fixed z-50 text-xs rounded-lg px-3 py-2 max-w-[220px] pointer-events-none"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 40,
            background: "#1A1A1F",
            border: "1px solid #2A2A32",
            color: "#F0F0F5",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="font-medium">{tooltip.date}</div>
          {tooltip.info ? (
            <>
              <div className="text-[#8B8B9E]">Score {tooltip.info.score}/100 · {tooltip.info.likes} likes · {tooltip.info.comments} comments</div>
              <div className="mt-1 text-[#55555F] leading-snug">{tooltip.info.content}…</div>
            </>
          ) : <div className="text-[#55555F]">Pas de post ce jour-là</div>}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-[#55555F]">
        <span>Faible</span>
        {["#1A1A1F", "#064E3B", "#10B981", "#34D399"].map((c) => (
          <span key={c} className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />
        ))}
        <span>Viral</span>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg" style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderRadius: "10px" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #2A2A32" }}>
          <h2 className="font-semibold text-[#F0F0F5]">Ajouter un post</h2>
          <button onClick={onClose} className="text-[#55555F] hover:text-[#F0F0F5]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#8B8B9E] mb-1">Contenu *</label>
            <textarea
              required rows={5}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none transition-all"
              style={{ background: "#111115", border: "1px solid #2A2A32", color: "#F0F0F5" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Date de publication", key: "published_at", type: "date" },
              { label: "Vues", key: "views", type: "number" },
              { label: "Likes", key: "likes", type: "number" },
              { label: "Commentaires", key: "comments", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-[#8B8B9E] mb-1">{label}</label>
                <input
                  type={type}
                  min={type === "number" ? "0" : undefined}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
                  style={{ background: "#111115", border: "1px solid #2A2A32", color: "#F0F0F5" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8B8B9E] mb-1">URL du post (optionnel)</label>
            <input
              type="url"
              className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
              style={{ background: "#111115", border: "1px solid #2A2A32", color: "#F0F0F5" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
              value={form.post_url}
              onChange={(e) => setForm({ ...form, post_url: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8B8B9E] hover:text-[#F0F0F5]">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
              style={{ background: "#10B981", color: "#0F0F10" }}
            >
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
  const [url, setUrl]     = useState("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-md p-6" style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderRadius: "10px" }}>
        <h2 className="font-semibold text-[#F0F0F5] mb-1">Lier mon compte LinkedIn</h2>
        <p className="text-sm text-[#8B8B9E] mb-4">Renseigne l'URL de ton profil pour importer tes posts automatiquement.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            required
            placeholder="https://www.linkedin.com/in/ton-profil"
            className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
            style={{ background: "#111115", border: "1px solid #2A2A32", color: "#F0F0F5" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-[#8B8B9E]">Annuler</button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
              style={{ background: "#10B981", color: "#0F0F10" }}
            >
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
  const [input, setInput]   = useState("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-md p-6" style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderRadius: "10px" }}>
        <h2 className="font-semibold text-[#F0F0F5] mb-2">Délier le compte</h2>
        <p className="text-sm text-[#8B8B9E] mb-4">Es-tu sûr ? Cette action supprime tous tes posts importés.</p>
        <div className="rounded-lg px-3 py-2 mb-4 text-sm" style={{ background: "#450A0A", border: "1px solid #EF4444", color: "#EF4444" }}>
          Compte à délier : <strong>linkedin.com/in/{slug}</strong>
        </div>
        <p className="text-sm text-[#8B8B9E] mb-2">Tape <strong className="text-[#F0F0F5]">CONFIRMER</strong> pour continuer :</p>
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="CONFIRMER"
          className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none transition-all"
          style={{ background: "#111115", border: "1px solid #2A2A32", color: "#F0F0F5" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#EF4444"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
        />
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#8B8B9E]">Annuler</button>
          <button
            onClick={handleConfirm}
            disabled={input !== "CONFIRMER" || loading}
            className="px-5 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
            style={{ background: "#450A0A", color: "#EF4444", border: "1px solid #EF4444" }}
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
  const [posts, setPosts]           = useState<MyPost[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [importing, setImporting]   = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysis, setAnalysis]     = useState<AnalysisResult | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showLink, setShowLink]     = useState(false);
  const [showUnlink, setShowUnlink] = useState(false);
  const [importMsg, setImportMsg]   = useState<string | null>(null);

  // ── Coach IA state ──
  const [coachReport, setCoachReport]         = useState<CoachReport | null>(null);
  const [coachPredictions, setCoachPredictions] = useState<CoachPredictionDB[]>([]);
  const [coachKnowledge, setCoachKnowledge]   = useState<CoachKnowledge[]>([]);
  const [coachHistory, setCoachHistory]       = useState<CoachReport[]>([]);
  const [coachGenerating, setCoachGenerating] = useState(false);
  const [showLearnings, setShowLearnings]     = useState(false);
  const [showCoachHistory, setShowCoachHistory] = useState(false);
  const [predFeedback, setPredFeedback]       = useState<Record<string, "worked" | "didnt_work">>({});

  const loadCoachData = useCallback(async () => {
    const [reportRes, knowledgeRes] = await Promise.all([
      fetch("/api/coach/report"),
      fetch("/api/coach/knowledge"),
    ]);
    if (reportRes.ok) {
      const data = await reportRes.json();
      setCoachReport(data.report ?? null);
      setCoachPredictions(data.predictions ?? []);
      setCoachHistory(data.history ?? []);
    }
    if (knowledgeRes.ok) {
      setCoachKnowledge(await knowledgeRes.json());
    }
  }, []);

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
  useEffect(() => { loadCoachData(); }, [loadCoachData]);

  // suppress unused warning
  void coachKnowledge;

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
    if (res.ok) setAnalysis(data);
    setAnalyzing(false);
  }

  async function handleDelete(id: string) {
    setPosts((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/my-posts/${id}`, { method: "DELETE" });
  }

  async function handleGenerateCoach() {
    setCoachGenerating(true);
    const res = await fetch("/api/coach/generate", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCoachReport(data.report ?? null);
      setCoachPredictions(data.predictions ?? []);
      await loadCoachData();
    }
    setCoachGenerating(false);
  }

  async function handlePredictionFeedback(predId: string, feedback: "worked" | "didnt_work") {
    setPredFeedback((prev) => ({ ...prev, [predId]: feedback }));
    await fetch("/api/coach/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_id: predId, feedback }),
    });
  }

  // ── Score computation ──
  const maxRaw = posts.length > 0 ? Math.max(...posts.map((p) => calcRaw(p))) : 0;
  const postScores = new Map(posts.map((p) => [p.id, calcScore(calcRaw(p), maxRaw)]));

  const avgScore = posts.length > 0
    ? Math.round(posts.reduce((s, p) => s + (postScores.get(p.id) ?? 0), 0) / posts.length)
    : 0;

  const bestPost      = posts.reduce<MyPost | null>((best, p) => (!best || p.likes > best.likes ? p : best), null);
  const bestPostScore = bestPost ? (postScores.get(bestPost.id) ?? 0) : 0;

  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  const monthLikes      = posts
    .filter((p) => p.published_at && p.published_at >= thisMonthStart.toISOString().slice(0, 10))
    .reduce((s, p) => s + p.likes, 0);
  const estimatedReach = monthLikes * 35;

  const postDays = new Set(posts.map((p) => p.published_at?.slice(0, 10)).filter(Boolean));
  let streak = 0;
  const cur = new Date();
  while (true) {
    const d = cur.toISOString().slice(0, 10);
    if (!postDays.has(d)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  const streakDisplay = streak === 0
    ? "Pas de streak actif"
    : streak >= 7
      ? `🔥 ${streak} jours de streak !`
      : `📅 ${streak} jour${streak > 1 ? "s" : ""} consécutif${streak > 1 ? "s" : ""}`;

  const lineData = posts
    .filter((p) => p.published_at)
    .sort((a, b) => (a.published_at! > b.published_at! ? 1 : -1))
    .slice(-30)
    .map((p) => ({
      date: p.published_at!.slice(0, 10),
      value: postScores.get(p.id) ?? 0,
      likes: p.likes,
      comments: p.comments,
    }));

  const formatMap: Record<string, { totalScore: number; count: number }> = {};
  posts.forEach((p) => {
    if (!p.format) return;
    if (!formatMap[p.format]) formatMap[p.format] = { totalScore: 0, count: 0 };
    formatMap[p.format].totalScore += postScores.get(p.id) ?? 0;
    formatMap[p.format].count += 1;
  });
  const barData = Object.entries(formatMap).map(([format, { totalScore, count }]) => ({
    format, avg: Math.round(totalScore / count),
  }));

  const FORMAT_COLORS: Record<string, string> = {
    liste: "#10b981", texte: "#6366f1", storytelling: "#f59e0b", carrousel: "#ef4444", court: "#8b5cf6",
  };

  const linkedinSlug = linkedinUrl
    ? linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "")
    : null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#55555F] text-sm" style={{ background: "#0F0F10" }}>
        Chargement…
      </div>
    );
  }

  // ── État non lié ───────────────────────────────────────────────────────────
  if (!linkedinUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ background: "#0F0F10" }}>
        <div
          className="p-10 text-center max-w-md w-full"
          style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderRadius: "10px" }}
        >
          <div
            className="w-12 h-12 rounded-[10px] flex items-center justify-center mx-auto mb-4"
            style={{ background: "#111115", border: "1px solid #2A2A32" }}
          >
            <Link2 size={20} className="text-[#55555F]" />
          </div>
          <h2 className="text-base font-semibold text-[#F0F0F5] mb-2">Aucun compte lié</h2>
          <p className="text-sm text-[#8B8B9E] mb-6 leading-relaxed">
            Lie ton profil LinkedIn pour importer tes posts et suivre tes performances automatiquement.
          </p>
          <button
            onClick={() => setShowLink(true)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg mx-auto transition-all active:scale-[0.98]"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            <Link2 size={14} />
            Lier mon compte LinkedIn
          </button>
          <div className="mt-6 pt-6" style={{ borderTop: "1px solid #2A2A32" }}>
            <p className="text-xs text-[#55555F] mb-3">Ou ajoute des posts manuellement</p>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#8B8B9E] hover:text-[#F0F0F5] rounded-lg mx-auto transition-all"
              style={{ border: "1px solid #2A2A32" }}
            >
              <Plus size={13} />
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

  // ── État lié ───────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: "#0F0F10" }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-2xl font-semibold text-[#F0F0F5]"
              style={{ letterSpacing: "-0.02em" }}
            >
              Mon compte
            </h1>
            <p className="text-[#55555F] text-sm mt-1">Suivi de tes performances LinkedIn personnelles</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            <Plus size={14} />
            Ajouter un post
          </button>
        </div>

        {/* Bannière compte lié */}
        <div
          className="flex items-center gap-3 rounded-[10px] px-4 py-3"
          style={{ background: "#0D2B22", border: "1px solid #064E3B" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#064E3B" }}
          >
            <Link2 size={14} className="text-[#10B981]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#10B981]">Compte lié</p>
            <p className="text-xs text-[#059669] truncate">linkedin.com/in/{linkedinSlug}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              style={{ background: "#064E3B", color: "#10B981", border: "1px solid #059669" }}
            >
              <RefreshCw size={11} className={importing ? "animate-spin" : ""} />
              {importing ? "Import…" : "↻ Mettre à jour"}
            </button>
            <button
              onClick={() => setShowUnlink(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-[#8B8B9E] hover:text-[#EF4444]"
              style={{ border: "1px solid #2A2A32" }}
            >
              <Link2Off size={11} />
              Délier
            </button>
          </div>
        </div>

        {importMsg && (
          <div
            className="text-sm rounded-lg px-4 py-3"
            style={
              importMsg.includes("Erreur")
                ? { background: "#450A0A", border: "1px solid #EF4444", color: "#EF4444" }
                : { background: "#064E3B", border: "1px solid #10B981", color: "#10B981" }
            }
          >
            {importMsg}
          </div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Score moyen", value: `${avgScore}/100`, sub: "likes×2 + comments×5 (normalisé)" },
            { label: "Meilleur post", value: bestPost ? `Score ${bestPostScore}` : "—", sub: bestPost ? `${bestPost.likes} likes · ${bestPost.comments} commentaires` : "Aucun post" },
            { label: "Posts suivis", value: posts.length.toString(), sub: "dans ta bibliothèque" },
            { label: "Streak actuel", value: streakDisplay, sub: streak > 0 ? "jours consécutifs" : "Poste aujourd'hui !" },
            { label: "Reach ce mois", value: estimatedReach >= 1000 ? `${Math.round(estimatedReach / 1000)}k` : estimatedReach.toString(), sub: "estimation sur tes likes" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="card">
              <p className="label-section mb-2">{label}</p>
              <div
                className="text-[26px] font-bold text-[#F0F0F5] leading-tight mb-1"
                style={{ fontFamily: "var(--font-geist-mono), monospace" }}
              >
                {value}
              </div>
              <div className="text-[11px] text-[#55555F] leading-snug">{sub}</div>
            </div>
          ))}
        </div>

        {posts.length > 0 && (
          <>
            {/* Line chart */}
            <div className="card">
              <h2 className="font-semibold text-[#F0F0F5] mb-1">Score de performance par post</h2>
              <p className="text-xs text-[#55555F] mb-4">Score 0-100 · likes × 2 + comments × 5 + shares × 3, normalisé sur ton meilleur post</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E26" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#55555F" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#55555F" }} tickLine={false} axisLine={false}
                    domain={[0, 100]}
                    label={{ value: "Score", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#55555F" } }}
                  />
                  <Tooltip
                    formatter={(v, _n, item) => {
                      const d = item?.payload;
                      return [`Score ${v}/100 · ${d?.likes ?? 0} likes · ${d?.comments ?? 0} comments`, ""];
                    }}
                    labelFormatter={(l) => `Le ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #2A2A32", background: "#1A1A1F", color: "#F0F0F5" }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bar chart */}
            {barData.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-[#F0F0F5] mb-1">Score moyen par format</h2>
                <p className="text-xs text-[#55555F] mb-5">Score 0-100 — plus c'est haut, plus ce format performe pour toi</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E26" />
                    <XAxis dataKey="format" tick={{ fontSize: 12, fill: "#55555F" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#55555F" }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      formatter={(v) => [`${v}/100`, "Score moyen"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #2A2A32", background: "#1A1A1F", color: "#F0F0F5" }}
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
            <div className="card">
              <h2 className="font-semibold text-[#F0F0F5] mb-5">Heatmap d'activité</h2>
              <Heatmap posts={posts} />
            </div>
          </>
        )}

        {/* Coach IA */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-[#F0F0F5]">🧠 Coach IA</h2>
              <p className="text-xs text-[#55555F] mt-0.5">Analyse stratégique personnalisée — algorithme LinkedIn 2025/2026</p>
            </div>
            <button
              onClick={handleGenerateCoach}
              disabled={coachGenerating || posts.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "#10B981", color: "#0F0F10" }}
            >
              <Brain size={14} className={coachGenerating ? "animate-pulse" : ""} />
              {coachGenerating ? "Analyse en cours…" : "Générer l'analyse"}
            </button>
          </div>

          {coachGenerating && (
            <div className="flex flex-col items-center justify-center py-12 text-[#55555F]">
              <Brain size={32} className="animate-pulse text-[#10B981] mb-3" />
              <p className="text-sm">Le coach analyse vos données…</p>
              <p className="text-xs text-[#55555F] mt-1">Croisement algo LinkedIn × vos patterns personnels</p>
            </div>
          )}

          {coachReport && !coachGenerating && (
            <div className="space-y-5">
              {/* Analyse de la semaine */}
              <div
                className="rounded-lg p-4"
                style={{ background: "#0D1F19", borderLeft: "3px solid #10B981" }}
              >
                <p className="label-section text-[#10B981] mb-2">Analyse de la semaine</p>
                <p className="text-sm text-[#F0F0F5] leading-relaxed">{coachReport.analysis}</p>
              </div>

              {/* Recommandations */}
              {coachReport.recommendations?.length > 0 && (
                <div>
                  <p className="label-section mb-3">Mes recommandations</p>
                  <div className="grid gap-3">
                    {coachReport.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-4"
                        style={{ background: "#111115", border: "1px solid #2A2A32" }}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center mt-0.5"
                            style={{ background: "#0D2B22", color: "#10B981" }}
                          >
                            {i + 1}
                          </span>
                          <div className="flex-1 space-y-1.5">
                            <p className="font-semibold text-[#F0F0F5] text-sm">{rec.titre}</p>
                            <p className="text-sm text-[#8B8B9E]">{rec.conseil}</p>
                            <p className="text-xs text-[#55555F]">{rec.why}</p>
                            <div className="flex items-start gap-2 mt-1.5">
                              <CheckCircle size={12} className="text-[#10B981] shrink-0 mt-0.5" />
                              <p className="text-xs text-[#10B981] font-medium">{rec.action}</p>
                            </div>
                            {rec.expected_impact && (
                              <span
                                className="inline-block text-xs rounded-full px-2 py-0.5"
                                style={{ background: "#451A03", color: "#F59E0B" }}
                              >
                                {rec.expected_impact}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learnings (collapsible) */}
              {coachReport.learnings?.length > 0 && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #2A2A32" }}>
                  <button
                    onClick={() => setShowLearnings((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                    style={{ background: "#111115" }}
                  >
                    <p className="label-section">
                      Ce que j&apos;ai appris ({coachReport.learnings.length})
                    </p>
                    {showLearnings ? <ChevronUp size={13} className="text-[#55555F]" /> : <ChevronDown size={13} className="text-[#55555F]" />}
                  </button>
                  {showLearnings && (
                    <div style={{ borderTop: "1px solid #2A2A32" }}>
                      {coachReport.learnings.map((l, i) => (
                        <div
                          key={i}
                          className="px-4 py-3"
                          style={{ borderBottom: "1px solid #1E1E26" }}
                        >
                          <p className="text-sm text-[#F0F0F5] mb-1">{l.pattern}</p>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "#222228" }}>
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${Math.round((l.confidence ?? 0) * 100)}%`, background: "#10B981" }}
                              />
                            </div>
                            <span className="text-xs text-[#55555F] shrink-0">{Math.round((l.confidence ?? 0) * 100)}%</span>
                          </div>
                          <p className="text-xs text-[#55555F]">{l.based_on}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prédictions */}
              {coachPredictions.length > 0 && (
                <div>
                  <p className="label-section mb-3">Mes prédictions pour la semaine</p>
                  <div className="grid gap-3">
                    {coachPredictions.map((pred) => {
                      const localFeedback = predFeedback[pred.id];
                      const finalFeedback = localFeedback ?? (pred.was_correct === true ? "worked" : pred.was_correct === false ? "didnt_work" : undefined);
                      return (
                        <div
                          key={pred.id}
                          className="flex items-start gap-3 rounded-lg p-4"
                          style={{ background: "#111115", border: "1px solid #2A2A32" }}
                        >
                          <span
                            className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium capitalize mt-0.5"
                            style={{ background: "#2D1B69", color: "#A78BFA" }}
                          >
                            {pred.prediction_type}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm text-[#F0F0F5]">{pred.prediction}</p>
                            {pred.expected_improvement && (
                              <p className="text-xs text-[#55555F] mt-0.5">Amélioration attendue : +{pred.expected_improvement}%</p>
                            )}
                          </div>
                          {!finalFeedback ? (
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handlePredictionFeedback(pred.id, "worked")}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                style={{ background: "#064E3B", color: "#10B981", border: "1px solid #10B981" }}
                              >
                                <CheckCircle size={11} /> Ça a marché
                              </button>
                              <button
                                onClick={() => handlePredictionFeedback(pred.id, "didnt_work")}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                                style={{ background: "#450A0A", color: "#EF4444", border: "1px solid #EF4444" }}
                              >
                                <XCircle size={11} /> Pas concluant
                              </button>
                            </div>
                          ) : (
                            <span
                              className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-lg"
                              style={
                                finalFeedback === "worked"
                                  ? { background: "#064E3B", color: "#10B981" }
                                  : { background: "#450A0A", color: "#EF4444" }
                              }
                            >
                              {finalFeedback === "worked" ? "✅ Concluant" : "❌ Pas concluant"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Historique */}
              {coachHistory.length > 1 && (
                <div>
                  <button
                    onClick={() => setShowCoachHistory((v) => !v)}
                    className="flex items-center gap-2 text-xs font-medium text-[#55555F] hover:text-[#8B8B9E] transition-colors"
                  >
                    {showCoachHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    Voir l&apos;historique ({coachHistory.length - 1} rapport{coachHistory.length > 2 ? "s" : ""} précédent{coachHistory.length > 2 ? "s" : ""})
                  </button>
                  {showCoachHistory && (
                    <div className="mt-3 space-y-2">
                      {coachHistory.slice(1).map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg p-4"
                          style={{ background: "#111115", border: "1px solid #2A2A32" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-[#8B8B9E]">Semaine du {r.week_start}</p>
                            <span className="text-xs text-[#55555F]">
                              {(r.recommendations as unknown[])?.length ?? 0} recommandations
                            </span>
                          </div>
                          <p className="text-sm text-[#8B8B9E] leading-relaxed">{r.analysis}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!coachReport && !coachGenerating && (
            <p className="text-sm text-[#55555F]">
              Lance l&apos;analyse pour obtenir des recommandations stratégiques basées sur l&apos;algo LinkedIn 2025/2026 et tes données personnelles.
            </p>
          )}
        </div>

        {/* Analyse IA */}
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-[#F0F0F5]">Insights personnels IA</h2>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || posts.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "#10B981", color: "#0F0F10" }}
            >
              <Brain size={14} />
              {analyzing ? "Analyse en cours…" : "Analyser mes performances"}
            </button>
          </div>

          {analysis ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Ce qui marche */}
              <div className="rounded-lg p-4" style={{ background: "#0D1F19", borderLeft: "3px solid #10B981" }}>
                <h3 className="font-semibold text-[#10B981] mb-3 text-sm">💪 Ce qui marche</h3>
                <div className="space-y-1.5 text-sm">
                  <p className="text-[#8B8B9E]">Format : <strong className="capitalize text-[#F0F0F5]">{analysis.best_format}</strong></p>
                  <p className="text-[#8B8B9E]">Hook : <strong className="capitalize text-[#F0F0F5]">{analysis.best_hook}</strong></p>
                </div>
                {analysis.insights.slice(0, Math.ceil(analysis.insights.length / 2)).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {analysis.insights.slice(0, Math.ceil(analysis.insights.length / 2)).map((ins, i) => (
                      <li key={i} className="text-xs text-[#10B981] flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">✓</span>{ins}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Points d'amélioration */}
              <div className="rounded-lg p-4" style={{ background: "#1C1200", borderLeft: "3px solid #F59E0B" }}>
                <h3 className="font-semibold text-[#F59E0B] mb-3 text-sm">⚠️ Points d&apos;amélioration</h3>
                {analysis.insights.slice(Math.ceil(analysis.insights.length / 2)).length > 0 ? (
                  <ul className="space-y-1.5">
                    {analysis.insights.slice(Math.ceil(analysis.insights.length / 2)).map((ins, i) => (
                      <li key={i} className="text-xs text-[#F59E0B] flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">•</span>{ins}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#8B8B9E]">Continue à analyser plus de posts pour voir les points faibles.</p>
                )}
              </div>

              {/* Meilleur moment */}
              <div className="rounded-lg p-4" style={{ background: "#0F2744", borderLeft: "3px solid #60A5FA" }}>
                <h3 className="font-semibold text-[#60A5FA] mb-3 text-sm">📅 Meilleur moment pour poster</h3>
                <p className="text-xl font-bold text-[#F0F0F5] capitalize" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
                  {analysis.best_day}
                </p>
                <p className="text-xs text-[#60A5FA] mt-1">Score moyen estimé : {Math.round(analysis.avg_engagement)}/100</p>
              </div>

              {/* 3 recommandations */}
              <div className="rounded-lg p-4" style={{ background: "#0D2B22", borderLeft: "3px solid #10B981" }}>
                <h3 className="font-semibold text-[#10B981] mb-3 text-sm">💡 3 recommandations concrètes</h3>
                <ul className="space-y-2">
                  {analysis.recommendations.slice(0, 3).map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#8B8B9E]">
                      <span className="font-bold shrink-0 mt-0.5 text-[#10B981]">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#55555F]">Lance l&apos;analyse pour obtenir des recommandations personnalisées basées sur tes posts.</p>
          )}
        </div>

        {/* Table */}
        {posts.length > 0 ? (
          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid #2A2A32" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #2A2A32", background: "#1A1A1F" }}>
              <h2 className="font-semibold text-[#F0F0F5]">Tous tes posts</h2>
            </div>
            <table className="w-full text-sm" style={{ background: "#111115" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2A2A32" }}>
                  {["Date", "Contenu", "Format", "Likes", "Comments", "Score", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-[#55555F] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid #1E1E26" }}
                  >
                    <td className="px-4 py-3 text-[#55555F] whitespace-nowrap">{p.published_at?.slice(0, 10) ?? "—"}</td>
                    <td className="px-4 py-3 text-[#8B8B9E] max-w-[260px]"><span className="line-clamp-2">{p.content}</span></td>
                    <td className="px-4 py-3">
                      {p.format ? (
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-medium"
                          style={{ background: "#1A1A1F", color: "#8B8B9E" }}
                        >
                          {p.format}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#F0F0F5]">{p.likes}</td>
                    <td className="px-4 py-3 text-[#F0F0F5]">{p.comments}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const score = postScores.get(p.id) ?? 0;
                        const sl    = scoreLabel(score);
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className="font-bold text-sm"
                              style={{ fontFamily: "var(--font-geist-mono), monospace", color: "#F0F0F5" }}
                            >
                              {score}
                            </span>
                            <span
                              className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                              style={{ background: sl.bg, color: sl.color }}
                            >
                              {sl.text}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(p.id)} className="text-[#55555F] hover:text-[#EF4444] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-[#55555F] text-sm">Aucun post suivi pour l'instant.</div>
            <div className="text-[#55555F] text-xs mt-1">Clique sur "↻ Mettre à jour" pour importer tes derniers posts LinkedIn.</div>
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
