"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronRight, Copy, RefreshCw, CheckCircle2, Pencil, ArrowLeft, ChevronDown } from "lucide-react";
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
  return "#9CA3AF";
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
        "w-full resize-none bg-transparent text-[14px] leading-relaxed text-zinc-900 placeholder-zinc-400 focus:outline-none",
        className
      )}
    />
  );
}

// ─── Recent creations ─────────────────────────────────────────────────────────

type RecentPost = {
  id: string;
  content: string;
  subject?: string | null;
  format?: string | null;
  created_at: string;
};

function RecentCreations() {
  const { showToast } = useToast();
  const [open,   setOpen]   = useState(false);
  const [posts,  setPosts]  = useState<RecentPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/agent/recent")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setPosts(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

  async function handleCopy(content: string) {
    await navigator.clipboard.writeText(content);
    showToast("Post copié !");
  }

  return (
    <div className="w-full max-w-[680px] mt-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 transition-all"
      >
        <span className="text-[12px] font-medium uppercase tracking-wider text-zinc-400">
          Créations récentes
        </span>
        <ChevronDown
          size={14}
          className={cn("text-zinc-400 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white overflow-hidden">
          {!loaded ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-zinc-300" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center py-8 text-[13px] text-zinc-400">
              Aucune création récente
            </p>
          ) : (
            <div className="divide-y divide-zinc-100">
              {posts.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] mb-1 text-zinc-400">
                      {new Date(p.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "2-digit",
                      })}
                      {p.format && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-500 border border-zinc-200">
                          {p.format}
                        </span>
                      )}
                    </p>
                    <p className="text-[13px] leading-snug line-clamp-2 text-zinc-600">
                      {p.content}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => handleCopy(p.content)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-all"
                    >
                      <Copy size={11} />
                      Recopier
                    </button>
                    <Link
                      href="/calendar"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-brand-500 hover:text-brand-600 transition-all"
                    >
                      Calendrier →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phase 1: Context ─────────────────────────────────────────────────────────

function ContextPhase({ onSubmit }: { onSubmit: (ctx: string) => void }) {
  const [context,    setContext]    = useState("");
  const [activeQ,    setActiveQ]    = useState<InspirationQ | null>(null);
  const [miniAnswer, setMiniAnswer] = useState("");

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
    <div className="min-h-screen flex flex-col items-center py-12 px-4 bg-zinc-50">
      <div className="w-full max-w-[680px]">
        {/* Breadcrumb */}
        <p className="text-[11px] font-medium uppercase tracking-widest mb-8 text-zinc-400">
          Créer&nbsp;→&nbsp;<span className="text-brand-500">Contexte</span>
        </p>

        <h1 className="text-[24px] font-semibold tracking-tight mb-2 text-zinc-900">
          Qu'est-ce qui s'est passé cette semaine ?
        </h1>
        <p className="text-[14px] mb-8 leading-relaxed text-zinc-500">
          Raconte-moi un moment, une réflexion, une victoire ou un échec dans ton business.
        </p>

        {/* Main textarea */}
        <div className={cn(
          "rounded-xl border p-4 mb-6 bg-white transition-all",
          context.trim().length >= 20 ? "border-brand-400 ring-1 ring-brand-200" : "border-zinc-200"
        )}>
          <AutoTextarea
            value={context}
            onChange={setContext}
            minHeight={140}
            autoFocus
            placeholder="Ex: J'ai perdu un client cette semaine parce que mon devis était trop détaillé. Ça m'a fait réaliser que les clients achètent la confiance, pas les livrables..."
          />
          {context.trim().length > 0 && (
            <p className="text-right text-[11px] mt-2 text-zinc-400">
              {context.trim().length} car.
            </p>
          )}
        </div>

        {/* Inspiration block */}
        {context.trim().length < 20 && (
          <div className="mb-6">
            <p className="text-[12px] font-medium mb-3 text-zinc-400">
              Tu manques d'inspiration ?
            </p>
            <div className="flex flex-col gap-2">
              {INSPIRATION_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  onClick={() => handleInspirationClick(q)}
                  className={cn(
                    "text-left px-4 py-2.5 rounded-xl text-[13px] border transition-all",
                    activeQ?.label === q.label
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                  )}
                >
                  {q.emoji} {q.label}
                </button>
              ))}
            </div>

            {/* Mini-chat when question selected */}
            {activeQ && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
                <p className="text-[13px] mb-3 leading-relaxed text-zinc-700">
                  {activeQ.followup}
                </p>
                <textarea
                  autoFocus
                  value={miniAnswer}
                  onChange={(e) => setMiniAnswer(e.target.value)}
                  placeholder="Ta réponse..."
                  rows={3}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && miniAnswer.trim()) { e.preventDefault(); handleMiniSubmit(); }}}
                  className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-zinc-800 placeholder-zinc-400 focus:outline-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleMiniSubmit}
                    disabled={!miniAnswer.trim()}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-all disabled:opacity-40"
                  >
                    Ajouter au contexte →
                  </button>
                  <button
                    onClick={() => setActiveQ(null)}
                    className="px-3 py-1.5 rounded-lg text-[12px] text-zinc-400 hover:text-zinc-600 transition-all"
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Trouver mes angles
          <ChevronRight size={16} />
        </button>

        <RecentCreations />
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
    <div className="min-h-screen flex flex-col items-center py-12 px-4 bg-zinc-50">
      <div className="w-full max-w-[680px]">
        {/* Breadcrumb */}
        <p className="text-[11px] font-medium uppercase tracking-widest mb-8 text-zinc-400">
          Créer&nbsp;→&nbsp;Contexte&nbsp;→&nbsp;<span className="text-brand-500">Angles</span>
        </p>

        {/* Context summary */}
        <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 mb-8">
          <p className="flex-1 text-[13px] leading-snug line-clamp-2 text-zinc-500">
            {context}
          </p>
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[12px] shrink-0 text-brand-500 hover:text-brand-600 transition-all"
          >
            <Pencil size={12} />
            Modifier
          </button>
        </div>

        <h2 className="text-[18px] font-semibold mb-1 text-zinc-900">Choisis tes angles</h2>
        <p className="text-[13px] mb-6 text-zinc-500">
          Sélectionne les angles que tu veux développer en posts.
        </p>

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={20} className="animate-spin text-brand-500" />
            <p className="text-[13px] text-zinc-500">Analyse du contexte…</p>
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
                  className={cn(
                    "text-left rounded-xl border p-4 transition-all",
                    isSelected ? "bg-white shadow-sm" : "bg-white border-zinc-200 hover:border-zinc-300"
                  )}
                  style={{ borderColor: isSelected ? color : undefined }}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                      style={{
                        borderColor: isSelected ? color : "#D1D5DB",
                        background:  isSelected ? color : "transparent",
                      }}
                    >
                      {isSelected && <CheckCircle2 size={10} className="text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[16px]">{angle.emoji}</span>
                        <span
                          className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: `${color}18`, color }}
                        >
                          {angle.type}
                        </span>
                      </div>
                      <p className="text-[14px] font-semibold mb-1 text-zinc-900">{angle.titre}</p>
                      <p className="text-[12px] mb-2 leading-snug text-zinc-500">{angle.description}</p>
                      <p className="text-[12px] italic text-brand-500">« {angle.hook_preview} »</p>
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
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
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
      body: JSON.stringify({ post_id: post.id, context, angle: post.angle }),
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
    <div className={cn(
      "rounded-xl border bg-white flex flex-col transition-all",
      validated ? "border-brand-400 ring-1 ring-brand-100" : "border-zinc-200"
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        {angle && (
          <>
            <span className="text-[14px]">{angle.emoji}</span>
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{ background: `${color}18`, color }}
            >
              {angle.type}
            </span>
          </>
        )}
        {post.format && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 border border-zinc-200">
            {post.format}
          </span>
        )}
        {validated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-brand-500">
            <CheckCircle2 size={12} />
            Validé
          </span>
        )}
      </div>

      {/* Content */}
      <div className="relative px-4 py-3 flex-1">
        {post.regenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-10 rounded-b-none">
            <div className="flex items-center gap-2 text-[13px] text-brand-500">
              <Loader2 size={14} className="animate-spin" />
              Régénération…
            </div>
          </div>
        )}
        <AutoTextarea
          value={content}
          onChange={(v) => { setContent(v); onUpdate({ content: v }); }}
          minHeight={160}
          className="text-[13px] leading-relaxed text-zinc-800"
        />
        <p className="text-right text-[11px] mt-1 font-mono" style={{ color: charCountColor(charLen) }}>
          {charLen} car. {charLen >= 800 && charLen <= 1500 ? "✓" : charLen > 1500 ? "→ trop long" : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 border-t border-zinc-100">
        <button
          onClick={handleRegenerate}
          disabled={post.regenerating || validated}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 transition-all disabled:opacity-40"
        >
          <RefreshCw size={12} />
          Regénérer
        </button>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
            post.copied
              ? "border-brand-300 text-brand-500 bg-brand-50"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          )}
        >
          <Copy size={12} />
          {post.copied ? "Copié !" : "Copier"}
        </button>
        <button
          onClick={handleValidate}
          disabled={post.validating || validated}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ml-auto",
            validated
              ? "bg-brand-50 text-brand-600 border border-brand-200"
              : "bg-brand-500 text-white hover:bg-brand-600"
          )}
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
  const [phase,          setPhase]         = useState<Phase>("loading");
  const [context,        setContext]        = useState("");
  const [angles,         setAngles]         = useState<Angle[]>([]);
  const [anglesLoading,  setAnglesLoading]  = useState(false);
  const [posts,          setPosts]          = useState<PostState[]>([]);
  const [budgetExceeded, setBudgetExceeded] = useState(false);

  useEffect(() => { setPhase("context"); }, []);

  const validatedCount = posts.filter((p) => p.status === "validated").length;
  const copiedCount    = posts.filter((p) => p.copied).length;
  const anyInteraction = validatedCount > 0 || copiedCount > 0;

  async function handleContextSubmit(ctx: string) {
    setContext(ctx);
    setPhase("angles");
    setAnglesLoading(true);
    try {
      const res = await fetch("/api/agent/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: ctx }),
      });
      if (res.ok) {
        const data = await res.json();
        setAngles(Array.isArray(data) ? data : []);
      }
    } catch {}
    setAnglesLoading(false);
  }

  async function handleGenerate(selectedAngles: Angle[]) {
    setPhase("generating");
    try {
      const res = await fetch("/api/agent/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, angles: selectedAngles }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.error === "budget_exceeded") { setBudgetExceeded(true); }
        setPhase("angles");
        return;
      }
      const postsWithAngles: PostState[] = (data as GeneratedPost[]).map((p, i) => ({
        ...p,
        angle:        selectedAngles[i] ?? selectedAngles[0],
        regenerating: false,
        validating:   false,
        copied:       false,
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

  if (phase === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <Loader2 size={20} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (phase === "generating") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-5 px-4 text-center bg-zinc-50">
        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-brand-500" />
        </div>
        <div>
          <p className="text-[16px] font-semibold mb-1 text-zinc-900">Génération en cours…</p>
          <p className="text-[13px] text-zinc-500">
            L'agent analyse ton contexte et rédige tes posts.
          </p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (phase === "context") return <ContextPhase onSubmit={handleContextSubmit} />;

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

  // Posts phase
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const nextMonthLabel = nextMonth.toLocaleDateString("fr-FR", { month: "long" });

  return (
    <div className="min-h-screen pb-24 bg-zinc-50">
      {/* Budget exceeded banner */}
      {budgetExceeded && (
        <div className="flex items-center gap-3 px-6 py-3 text-[13px] bg-red-50 border-b border-red-200 text-red-600">
          <span>⚠️</span>
          <span>Budget mensuel atteint. Prochain reset : 1er {nextMonthLabel}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-5 border-b border-zinc-200 bg-white">
        <button
          onClick={() => setPhase("angles")}
          className="flex items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-600 transition-all"
        >
          <ArrowLeft size={14} />
          Angles
        </button>
        <span className="text-zinc-300">/</span>
        <p className="text-[11px] font-medium uppercase tracking-widest text-brand-500">
          Posts générés
        </p>
        <span className="ml-auto text-[12px] text-zinc-400">
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
        <div className="fixed bottom-0 left-60 right-0 z-20 flex items-center justify-between px-8 py-3 border-t border-zinc-200 bg-white/95 backdrop-blur-sm">
          <p className="text-[13px] text-zinc-500">
            <span className="font-semibold text-zinc-800">{validatedCount}</span> validé{validatedCount > 1 ? "s" : ""}
            {copiedCount > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-zinc-800">{copiedCount}</span> copié{copiedCount > 1 ? "s" : ""}
              </>
            )}
          </p>
          <button
            onClick={() => router.push("/calendar")}
            disabled={validatedCount === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Voir le calendrier
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
