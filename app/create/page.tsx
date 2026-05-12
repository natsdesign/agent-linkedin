"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight, Copy, RefreshCw, CheckCircle2, Pencil, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { GeneratedPost } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "context" | "angles" | "generating" | "posts";

type Angle = {
  type: "storytelling" | "liste" | "opinion" | "question";
  emoji: string;
  titre: string;
  description: string;
  hook_preview: string;
};

type PostState = GeneratedPost & {
  angle?: Angle;
  regenerating: boolean;
  validating: boolean;
  copied: boolean;
};

type InspirationQ = {
  emoji: string;
  label: string;
  followup: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const INSPIRATION_QUESTIONS: InspirationQ[] = [
  { emoji: "💬", label: "Tu as eu une conversation marquante ?", followup: "Décris-moi cette conversation en 2-3 phrases. Qu'est-ce qui t'a le plus marqué ?" },
  { emoji: "❌", label: "Tu as fait une erreur cette semaine ?", followup: "Décris-moi cette erreur en 2-3 phrases. Qu'est-ce qui s'est passé exactement ?" },
  { emoji: "💡", label: "Tu as appris quelque chose ?", followup: "Qu'est-ce que tu as appris ? D'où vient cette leçon ?" },
  { emoji: "🚫", label: "Tu as refusé quelque chose ?", followup: "Qu'est-ce que tu as refusé et pourquoi ? Qu'est-ce que ça dit de tes valeurs ?" },
  { emoji: "🔄", label: "Il y a un conseil que tu répètes souvent ?", followup: "Quel est ce conseil ? À qui le donnes-tu habituellement et dans quel contexte ?" },
];

const ANGLE_TYPE_COLORS: Record<string, string> = {
  storytelling: "#10B981",
  liste:        "#60A5FA",
  opinion:      "#F59E0B",
  question:     "#A78BFA",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charCountColor(len: number): string {
  if (len >= 800 && len <= 1500) return "#10B981";
  if (len > 0) return "#F59E0B";
  return "#55555F";
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  minHeight = 120,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      rows={1}
      style={{ minHeight }}
      className={cn(
        "w-full resize-none bg-transparent text-[14px] leading-relaxed text-[#F0F0F5] placeholder-[#55555F] focus:outline-none",
        className
      )}
    />
  );
}

// ─── Phase 1: Context ─────────────────────────────────────────────────────────

function ContextPhase({
  onSubmit,
}: {
  onSubmit: (ctx: string) => void;
}) {
  const [context, setContext]               = useState("");
  const [activeQ, setActiveQ]               = useState<InspirationQ | null>(null);
  const [miniAnswer, setMiniAnswer]         = useState("");

  const canSubmit = context.trim().length >= 20;

  function handleInspirationClick(q: InspirationQ) {
    setActiveQ(q);
    setMiniAnswer("");
  }

  function handleMiniSubmit() {
    if (!activeQ || !miniAnswer.trim()) return;
    const merged = context.trim()
      ? `${context.trim()}\n\n${activeQ.label.replace(" ?", "")} : ${miniAnswer.trim()}`
      : `${activeQ.label.replace(" ?", "")} : ${miniAnswer.trim()}`;
    setContext(merged);
    setActiveQ(null);
    setMiniAnswer("");
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: "#0F0F10" }}>
      <div className="w-full max-w-[680px]">
        {/* Breadcrumb */}
        <p className="text-[11px] font-medium uppercase tracking-widest mb-8" style={{ color: "#55555F" }}>
          Créer&nbsp;→&nbsp;<span style={{ color: "#10B981" }}>Contexte</span>
        </p>

        <h1 className="text-[24px] font-semibold tracking-tight mb-2" style={{ color: "#F0F0F5" }}>
          Qu'est-ce qui s'est passé cette semaine ?
        </h1>
        <p className="text-[14px] mb-8 leading-relaxed" style={{ color: "#8B8B9E" }}>
          Raconte-moi un moment, une réflexion, une victoire ou un échec dans ton business.
        </p>

        {/* Main textarea */}
        <div
          className="rounded-[10px] border p-4 mb-6 transition-all"
          style={{ background: "#111115", borderColor: context.trim().length >= 20 ? "#10B981" : "#2A2A32" }}
        >
          <AutoTextarea
            value={context}
            onChange={setContext}
            minHeight={140}
            autoFocus
            placeholder={`Ex: J'ai perdu un client cette semaine parce que mon devis était trop détaillé. Ça m'a fait réaliser que les clients achètent la confiance, pas les livrables...`}
          />
          {context.trim().length > 0 && (
            <p className="text-right text-[11px] mt-2" style={{ color: "#55555F" }}>
              {context.trim().length} car.
            </p>
          )}
        </div>

        {/* Inspiration block — shown when textarea is nearly empty */}
        {context.trim().length < 20 && (
          <div className="mb-6">
            <p className="text-[12px] font-medium mb-3" style={{ color: "#55555F" }}>
              Tu manques d'inspiration ?
            </p>
            <div className="flex flex-col gap-2">
              {INSPIRATION_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleInspirationClick(q)}
                  className="text-left px-4 py-2.5 rounded-[8px] text-[13px] border transition-all"
                  style={{
                    background: activeQ?.label === q.label ? "#0D2B22" : "#1A1A1F",
                    borderColor: activeQ?.label === q.label ? "#10B981" : "#2A2A32",
                    color: activeQ?.label === q.label ? "#10B981" : "#8B8B9E",
                  }}
                >
                  {q.emoji} {q.label}
                </button>
              ))}
            </div>

            {/* Mini-chat when question selected */}
            {activeQ && (
              <div
                className="mt-4 rounded-[10px] border p-4"
                style={{ background: "#0D2B22", borderColor: "#10B981" }}
              >
                <p className="text-[13px] mb-3 leading-relaxed" style={{ color: "#F0F0F5" }}>
                  {activeQ.followup}
                </p>
                <textarea
                  autoFocus
                  value={miniAnswer}
                  onChange={(e) => setMiniAnswer(e.target.value)}
                  placeholder="Ta réponse..."
                  rows={3}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && miniAnswer.trim()) { e.preventDefault(); handleMiniSubmit(); }}}
                  className="w-full resize-none bg-transparent text-[13px] leading-relaxed placeholder-[#55555F] focus:outline-none mb-3"
                  style={{ color: "#F0F0F5" }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleMiniSubmit}
                    disabled={!miniAnswer.trim()}
                    className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all disabled:opacity-40"
                    style={{ background: "#10B981", color: "#0F0F10" }}
                  >
                    Ajouter au contexte →
                  </button>
                  <button
                    onClick={() => setActiveQ(null)}
                    className="px-3 py-1.5 rounded-[6px] text-[12px] transition-all"
                    style={{ color: "#55555F" }}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={() => canSubmit && onSubmit(context.trim())}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[8px] text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#10B981", color: "#0F0F10" }}
        >
          Trouver mes angles
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Phase 2: Angles ──────────────────────────────────────────────────────────

function AnglesPhase({
  context,
  angles,
  loading,
  onEdit,
  onGenerate,
}: {
  context: string;
  angles: Angle[];
  loading: boolean;
  onEdit: () => void;
  onGenerate: (selected: Angle[]) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const selectedAngles = angles.filter((_, i) => selected.has(i));
  const canGenerate = selected.size > 0;

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4" style={{ background: "#0F0F10" }}>
      <div className="w-full max-w-[680px]">
        {/* Breadcrumb */}
        <p className="text-[11px] font-medium uppercase tracking-widest mb-8" style={{ color: "#55555F" }}>
          Créer&nbsp;→&nbsp;Contexte&nbsp;→&nbsp;<span style={{ color: "#10B981" }}>Angles</span>
        </p>

        {/* Context summary */}
        <div
          className="flex items-start gap-3 rounded-[8px] border px-4 py-3 mb-8"
          style={{ background: "#1A1A1F", borderColor: "#2A2A32" }}
        >
          <p className="flex-1 text-[13px] leading-snug line-clamp-2" style={{ color: "#8B8B9E" }}>
            {context}
          </p>
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[12px] shrink-0 transition-all hover:opacity-80"
            style={{ color: "#10B981" }}
          >
            <Pencil size={12} />
            Modifier
          </button>
        </div>

        <h2 className="text-[18px] font-semibold mb-1" style={{ color: "#F0F0F5" }}>
          Choisis tes angles
        </h2>
        <p className="text-[13px] mb-6" style={{ color: "#8B8B9E" }}>
          Sélectionne les angles que tu veux développer en posts.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "#10B981" }} />
            <p className="text-[13px]" style={{ color: "#8B8B9E" }}>Analyse du contexte…</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-8">
            {angles.map((angle, i) => {
              const isSelected = selected.has(i);
              const color = ANGLE_TYPE_COLORS[angle.type] ?? "#10B981";
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="text-left rounded-[10px] border p-4 transition-all"
                  style={{
                    background: isSelected ? "#0D1F19" : "#1A1A1F",
                    borderColor: isSelected ? color : "#2A2A32",
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={{
                        borderColor: isSelected ? color : "#55555F",
                        background: isSelected ? color : "transparent",
                      }}
                    >
                      {isSelected && <CheckCircle2 size={10} style={{ color: "#0F0F10" }} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Type badge */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[16px]">{angle.emoji}</span>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: `${color}20`, color }}
                        >
                          {angle.type}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="text-[14px] font-semibold mb-1" style={{ color: "#F0F0F5" }}>
                        {angle.titre}
                      </p>

                      {/* Description */}
                      <p className="text-[12px] mb-2 leading-snug" style={{ color: "#8B8B9E" }}>
                        {angle.description}
                      </p>

                      {/* Hook preview */}
                      <p className="text-[12px] italic" style={{ color: "#10B981" }}>
                        « {angle.hook_preview} »
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={() => canGenerate && onGenerate(selectedAngles)}
          disabled={!canGenerate || loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-[8px] text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#10B981", color: "#0F0F10" }}
        >
          Générer {selected.size > 0 ? `${selected.size} post${selected.size > 1 ? "s" : ""}` : "les posts"}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Phase 3: Posts ───────────────────────────────────────────────────────────

function PostCard({
  post,
  context,
  onUpdate,
}: {
  post: PostState;
  context: string;
  onUpdate: (p: Partial<PostState>) => void;
}) {
  const { showToast } = useToast();
  const [content, setContent] = useState(post.content);
  const validated = post.status === "validated";
  const angle = post.angle;
  const color = angle ? ANGLE_TYPE_COLORS[angle.type] ?? "#10B981" : "#10B981";

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    onUpdate({ copied: true });
    showToast("Post copié !");
    setTimeout(() => onUpdate({ copied: false }), 2000);
  }

  async function handleValidate() {
    if (validated || post.validating) return;
    onUpdate({ validating: true });
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "validated" }),
    });
    if (res.ok) {
      onUpdate({ status: "validated", validating: false });
      showToast("Post validé ✓");
    } else {
      onUpdate({ validating: false });
    }
  }

  async function handleRegenerate() {
    if (post.regenerating) return;
    onUpdate({ regenerating: true });
    const res = await fetch("/api/agent/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post_id: post.id,
        context,
        angle: post.angle,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setContent(data.content);
      onUpdate({ content: data.content, status: "draft", regenerating: false });
    } else {
      onUpdate({ regenerating: false });
    }
  }

  const charLen = content.length;

  return (
    <div
      className="rounded-[10px] border flex flex-col transition-all"
      style={{
        background: "#1A1A1F",
        borderColor: validated ? "#10B981" : "#2A2A32",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: "#2A2A32" }}
      >
        {angle && (
          <>
            <span className="text-[14px]">{angle.emoji}</span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: `${color}20`, color }}
            >
              {angle.type}
            </span>
          </>
        )}
        {post.format && (
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#111115", color: "#8B8B9E", border: "1px solid #2A2A32" }}
          >
            {post.format}
          </span>
        )}
        {validated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold" style={{ color: "#10B981" }}>
            <CheckCircle2 size={12} />
            Validé
          </span>
        )}
      </div>

      {/* Content */}
      <div className="relative px-4 py-3 flex-1">
        {post.regenerating && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-b-none z-10"
            style={{ background: "rgba(26,26,31,0.9)" }}
          >
            <div className="flex items-center gap-2 text-[13px]" style={{ color: "#10B981" }}>
              <Loader2 size={14} className="animate-spin" />
              Régénération…
            </div>
          </div>
        )}
        <AutoTextarea
          value={content}
          onChange={(v) => { setContent(v); onUpdate({ content: v }); }}
          minHeight={160}
          className="text-[13px] leading-relaxed"
        />
        <p
          className="text-right text-[11px] mt-1 font-mono"
          style={{ color: charCountColor(charLen) }}
        >
          {charLen} car. {charLen >= 800 && charLen <= 1500 ? "✓" : charLen > 1500 ? "→ trop long" : ""}
        </p>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 px-4 py-3 border-t"
        style={{ borderColor: "#2A2A32" }}
      >
        <button
          onClick={handleRegenerate}
          disabled={post.regenerating || validated}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border transition-all disabled:opacity-40"
          style={{ background: "transparent", borderColor: "#2A2A32", color: "#8B8B9E" }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3A3A45")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2A32")}
        >
          <RefreshCw size={12} />
          Regénérer
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border transition-all"
          style={{ background: "transparent", borderColor: "#2A2A32", color: post.copied ? "#10B981" : "#8B8B9E" }}
        >
          <Copy size={12} />
          {post.copied ? "Copié !" : "Copier"}
        </button>
        <button
          onClick={handleValidate}
          disabled={post.validating || validated}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ml-auto"
          style={{
            background: validated ? "#064E3B" : "#10B981",
            color: validated ? "#10B981" : "#0F0F10",
          }}
        >
          {post.validating ? (
            <><Loader2 size={12} className="animate-spin" />Validation…</>
          ) : validated ? (
            <><CheckCircle2 size={12} />Validé ✓</>
          ) : (
            <><CheckCircle2 size={12} />Valider</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const router = useRouter();
  const [phase,          setPhase]          = useState<Phase>("loading");
  const [context,        setContext]         = useState("");
  const [angles,         setAngles]          = useState<Angle[]>([]);
  const [anglesLoading,  setAnglesLoading]   = useState(false);
  const [posts,          setPosts]           = useState<PostState[]>([]);
  const [budgetExceeded, setBudgetExceeded]  = useState(false);

  useEffect(() => {
    setPhase("context");
  }, []);

  const validatedCount = posts.filter((p) => p.status === "validated").length;
  const copiedCount    = posts.filter((p) => p.copied).length;
  const anyInteraction = validatedCount > 0 || copiedCount > 0;

  // ── Context submit → fetch angles ──────────────────────────────────────────

  async function handleContextSubmit(ctx: string) {
    setContext(ctx);
    setPhase("angles");
    setAnglesLoading(true);
    try {
      const res = await fetch("/api/agent/angles", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ context: ctx }),
      });
      if (res.ok) {
        const data = await res.json();
        setAngles(Array.isArray(data) ? data : []);
      }
    } catch {}
    setAnglesLoading(false);
  }

  // ── Angles submit → generate posts ─────────────────────────────────────────

  async function handleGenerate(selectedAngles: Angle[]) {
    setPhase("generating");
    try {
      const res = await fetch("/api/agent/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ context, angles: selectedAngles }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "budget_exceeded") { setBudgetExceeded(true); setPhase("angles"); return; }
        setPhase("angles");
        return;
      }
      const postsWithAngles: PostState[] = (data as GeneratedPost[]).map((p, i) => ({
        ...p,
        angle: selectedAngles[i] ?? selectedAngles[0],
        regenerating: false,
        validating: false,
        copied: false,
      }));
      setPosts(postsWithAngles);
      setPhase("posts");
    } catch {
      setPhase("angles");
    }
  }

  function updatePost(id: string, patch: Partial<PostState>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0F0F10" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#10B981" }} />
      </div>
    );
  }

  // ── Generating ──────────────────────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 px-4 text-center" style={{ background: "#0F0F10" }}>
        <div className="w-14 h-14 rounded-[12px] flex items-center justify-center" style={{ background: "#064E3B" }}>
          <Loader2 size={22} className="animate-spin" style={{ color: "#10B981" }} />
        </div>
        <div>
          <p className="text-[16px] font-semibold mb-1" style={{ color: "#F0F0F5" }}>Génération en cours…</p>
          <p className="text-[13px]" style={{ color: "#8B8B9E" }}>
            L'agent analyse ton contexte et rédige tes posts.
          </p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ background: "#10B981", animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Context phase ───────────────────────────────────────────────────────────

  if (phase === "context") {
    return <ContextPhase onSubmit={handleContextSubmit} />;
  }

  // ── Angles phase ────────────────────────────────────────────────────────────

  if (phase === "angles") {
    return (
      <AnglesPhase
        context={context}
        angles={angles}
        loading={anglesLoading}
        onEdit={() => setPhase("context")}
        onGenerate={handleGenerate}
      />
    );
  }

  // ── Posts phase ─────────────────────────────────────────────────────────────

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthLabel = nextMonth.toLocaleDateString("fr-FR", { month: "long" });

  return (
    <div className="min-h-screen pb-24" style={{ background: "#0F0F10" }}>
      {/* Budget exceeded banner */}
      {budgetExceeded && (
        <div className="flex items-center gap-3 px-6 py-3 text-[13px]" style={{ background: "#450A0A", color: "#EF4444" }}>
          <span>⚠️</span>
          <span>Budget mensuel atteint. Prochain reset : 1er {nextMonthLabel}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-6 border-b" style={{ borderColor: "#1E1E26" }}>
        <button
          onClick={() => setPhase("angles")}
          className="flex items-center gap-1.5 text-[12px] transition-all hover:opacity-80"
          style={{ color: "#55555F" }}
        >
          <ArrowLeft size={14} />
          Angles
        </button>
        <span style={{ color: "#2A2A32" }}>/</span>
        <p className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "#10B981" }}>
          Posts générés
        </p>
        <span className="ml-auto text-[12px]" style={{ color: "#55555F" }}>
          {posts.length} post{posts.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      <div className={cn(
        "px-8 pt-6 pb-4 grid gap-4 items-start",
        posts.length === 1 ? "grid-cols-1 max-w-[680px]" : "grid-cols-1 lg:grid-cols-2"
      )}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            context={context}
            onUpdate={(patch) => updatePost(post.id, patch)}
          />
        ))}
      </div>

      {/* Sticky bottom bar */}
      {anyInteraction && (
        <div
          className="fixed bottom-0 left-60 right-0 z-20 flex items-center justify-between px-8 py-3 border-t"
          style={{ background: "rgba(15,15,16,0.95)", borderColor: "#2A2A32", backdropFilter: "blur(8px)" }}
        >
          <p className="text-[13px]" style={{ color: "#8B8B9E" }}>
            <span className="font-semibold" style={{ color: "#F0F0F5" }}>{validatedCount}</span> validé{validatedCount > 1 ? "s" : ""}
            {copiedCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold" style={{ color: "#F0F0F5" }}>{copiedCount}</span> copié{copiedCount > 1 ? "s" : ""}
              </>
            )}
          </p>
          <button
            onClick={() => router.push("/calendar")}
            disabled={validatedCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] text-[13px] font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            Voir le calendrier
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
