"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Send,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { GeneratedPost } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "loading" | "chat" | "generating" | "posts";
type Step  = 1 | 2 | 3 | "done";

type ChatMessage = {
  id: string;
  from: "agent" | "user";
  text: string;
  suggestions?: string[];
};

type AgentContext = {
  question: string;
  suggestions: string[];
  toneSuggestions: string[];
  formatSuggestions: string[];
  defaultTone: string;
  defaultCount: number;
};

type Answers = {
  subjects: string;
  tone: string;
  count: number;
  format: string;
};

type PostState = GeneratedPost & {
  regenerating: boolean;
  validating: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseQ3(text: string): { count: number; format: string } {
  const countMatch = text.match(/\b(\d+)\b/);
  const count  = countMatch ? Math.min(10, Math.max(1, parseInt(countMatch[1], 10))) : 5;
  const formats = ["liste", "storytelling", "carrousel", "court", "texte"];
  const format = formats.find((f) => text.toLowerCase().includes(f)) ?? "texte";
  return { count, format };
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ background: "#10B981", animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      rows={1}
    />
  );
}

function PostCard({
  post,
  answers,
  onUpdate,
}: {
  post: PostState;
  answers: Partial<Answers>;
  onUpdate: (updated: Partial<PostState>) => void;
}) {
  const { showToast } = useToast();
  const [content, setContent] = useState(post.content);
  const [copied, setCopied]   = useState(false);
  const validated = post.status === "validated";

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    showToast("Post copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleValidate() {
    if (validated || post.validating) return;
    onUpdate({ validating: true });
    const res = await fetch(`/api/posts/${post.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: "validated" }),
    });
    if (res.ok) {
      onUpdate({ status: "validated", validating: false });
      showToast("Post validé");
    } else {
      onUpdate({ validating: false });
    }
  }

  async function handleRegenerate() {
    if (post.regenerating) return;
    onUpdate({ regenerating: true });
    const res = await fetch("/api/agent/regenerate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        post_id:  post.id,
        subjects: answers.subjects ?? "",
        tone:     answers.tone ?? "inspirant",
        format:   post.format ?? answers.format ?? "texte",
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

  return (
    <div
      className="flex flex-col transition-all duration-150"
      style={{
        background: validated ? "#0D2B22" : "#1A1A1F",
        border: `1px solid ${validated ? "#10B981" : "#2A2A32"}`,
        borderRadius: "10px",
      }}
    >
      {/* Badges */}
      <div
        className="flex items-center gap-2 px-4 pt-4 pb-3"
        style={{ borderBottom: "1px solid #2A2A32" }}
      >
        {post.format && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ background: "#064E3B", color: "#10B981" }}
          >
            {post.format}
          </span>
        )}
        {post.subject && (
          <span
            className="px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ background: "#1A1A1F", color: "#55555F" }}
          >
            {post.subject}
          </span>
        )}
        {validated && (
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
            <CheckCircle2 size={12} />
            Validé
          </span>
        )}
      </div>

      {/* Editable content */}
      <div className="relative px-4 py-3 flex-1">
        {post.regenerating && (
          <div
            className="absolute inset-0 rounded-b-[10px] flex items-center justify-center backdrop-blur-sm z-10"
            style={{ background: "rgba(15,15,16,0.8)" }}
          >
            <div className="flex items-center gap-2 text-[#10B981]">
              <Loader2 size={15} className="animate-spin" />
              <span className="text-xs font-medium">Régénération…</span>
            </div>
          </div>
        )}
        <AutoTextarea
          value={content}
          onChange={(v) => {
            setContent(v);
            onUpdate({ content: v });
          }}
          className="w-full bg-transparent text-sm text-[#F0F0F5] leading-relaxed resize-none focus:outline-none placeholder-[#55555F]"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4 pt-1">
        <button
          onClick={handleRegenerate}
          disabled={post.regenerating || validated}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8B8B9E] hover:text-[#F0F0F5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ border: "1px solid #2A2A32" }}
        >
          <RefreshCw size={12} />
          Regénérer
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#8B8B9E] hover:text-[#F0F0F5] transition-all"
          style={{ border: "1px solid #2A2A32" }}
        >
          <Copy size={12} />
          {copied ? "Copié !" : "Copier"}
        </button>
        <button
          onClick={handleValidate}
          disabled={post.validating || validated}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ml-auto active:scale-[0.98]",
            validated
              ? "cursor-default opacity-80"
              : "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={
            validated
              ? { background: "#064E3B", color: "#10B981", border: "1px solid #10B981" }
              : { background: "#10B981", color: "#0F0F10" }
          }
        >
          {post.validating ? (
            <><Loader2 size={12} className="animate-spin" />Validation…</>
          ) : validated ? (
            <><CheckCircle2 size={12} />Validé</>
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
  const [phase,       setPhase]       = useState<Phase>("loading");
  const [step,        setStep]        = useState<Step>(1);
  const [agentTyping, setAgentTyping] = useState(false);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [agentCtx,    setAgentCtx]    = useState<AgentContext | null>(null);
  const [answers,     setAnswers]     = useState<Partial<Answers>>({});
  const [input,       setInput]       = useState("");
  const [posts,       setPosts]       = useState<PostState[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, agentTyping]);

  useEffect(() => {
    async function init() {
      const profileRes = await fetch("/api/profile");
      const profile    = await profileRes.json();
      if (!profile?.id) { router.replace("/onboarding"); return; }
      const res = await fetch("/api/agent/start");
      if (!res.ok) throw new Error("Failed to load");
      const ctx: AgentContext = await res.json();
      setAgentCtx(ctx);
      setMessages([{ id: uid(), from: "agent", text: ctx.question, suggestions: ctx.suggestions }]);
      setPhase("chat");
    }
    init().catch(() => setPhase("chat"));
  }, [router]);

  const submitAnswer = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !agentCtx) return;
      setInput("");

      const userMsg: ChatMessage = { id: uid(), from: "user", text: trimmed };
      setMessages((prev) => [...prev, userMsg]);

      if (step === 1) {
        setAnswers((prev) => ({ ...prev, subjects: trimmed }));
        setAgentTyping(true);
        setTimeout(() => {
          setAgentTyping(false);
          setStep(2);
          setMessages((prev) => [
            ...prev,
            { id: uid(), from: "agent", text: "Quel ton pour cette semaine ?", suggestions: agentCtx.toneSuggestions },
          ]);
        }, 600);
      } else if (step === 2) {
        setAnswers((prev) => ({ ...prev, tone: trimmed }));
        setAgentTyping(true);
        setTimeout(() => {
          setAgentTyping(false);
          setStep(3);
          setMessages((prev) => [
            ...prev,
            { id: uid(), from: "agent", text: "Combien de posts et quel format principal ?", suggestions: agentCtx.formatSuggestions },
          ]);
        }, 600);
      } else if (step === 3) {
        const { count, format } = parseQ3(trimmed);
        setAnswers((prev) => ({ ...prev, count, format }));
        setStep("done");
      }
    },
    [step, agentCtx]
  );

  async function handleGenerate() {
    setPhase("generating");
    try {
      const res = await fetch("/api/agent/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(answers),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data: GeneratedPost[] = await res.json();
      setPosts(data.map((p) => ({ ...p, regenerating: false, validating: false })));
      setPhase("posts");
    } catch {
      setPhase("chat");
    }
  }

  function updatePost(id: string, patch: Partial<PostState>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const validatedCount = posts.filter((p) => p.status === "validated").length;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAnswer(input);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0F0F10" }}>
        <Loader2 size={22} className="animate-spin text-[#10B981]" />
      </div>
    );
  }

  // ── Generating ─────────────────────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 px-4 text-center" style={{ background: "#0F0F10" }}>
        <div
          className="w-14 h-14 rounded-[10px] flex items-center justify-center"
          style={{ background: "#0D2B22", border: "1px solid #10B981" }}
        >
          <Zap size={24} className="text-[#10B981] animate-pulse" fill="currentColor" />
        </div>
        <div>
          <p className="text-[#F0F0F5] font-semibold mb-1.5">Génération en cours…</p>
          <p className="text-sm text-[#55555F] max-w-xs">
            L&apos;agent analyse vos inspirations et génère vos posts.
          </p>
        </div>
        <div className="flex gap-1.5">
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

  // ── Posts ──────────────────────────────────────────────────────────────────

  if (phase === "posts") {
    return (
      <div className="flex flex-col min-h-screen pb-20" style={{ background: "#0F0F10" }}>
        <div className="px-8 pt-8 pb-6">
          <h1
            className="text-2xl font-semibold text-[#F0F0F5] tracking-tight"
            style={{ letterSpacing: "-0.02em" }}
          >
            Posts générés
          </h1>
          <p className="text-sm text-[#55555F] mt-0.5">
            {posts.length} post{posts.length > 1 ? "s" : ""} · éditez, validez ou regénérez
          </p>
        </div>

        <div className="flex-1 px-8 pb-4 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              answers={answers}
              onUpdate={(patch) => updatePost(post.id, patch)}
            />
          ))}
        </div>

        {/* Sticky bottom bar */}
        <div
          className="fixed bottom-0 right-0 z-20 px-8 py-3"
          style={{
            left: "220px",
            background: "rgba(10,10,15,0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid #2A2A32",
          }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#8B8B9E]">
              <span className="text-[#F0F0F5] font-semibold">{validatedCount}</span> post
              {validatedCount > 1 ? "s" : ""} validé{validatedCount > 1 ? "s" : ""}{" "}
              <span className="text-[#55555F]">sur {posts.length}</span>
            </p>
            <button
              onClick={() => router.push("/calendar")}
              disabled={validatedCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all active:scale-[0.98]"
              style={
                validatedCount > 0
                  ? { background: "#10B981", color: "#0F0F10" }
                  : { background: "#1A1A1F", color: "#55555F", cursor: "not-allowed" }
              }
            >
              Aller au calendrier
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0F0F10" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid #2A2A32", background: "#0A0A0F" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "#0D2B22", border: "1px solid #064E3B" }}
        >
          <Zap size={15} className="text-[#10B981]" />
        </div>
        <div>
          <h1 className="font-semibold text-[#F0F0F5] text-sm">Agent Créateur</h1>
          <p className="text-xs text-[#55555F]">
            {step === "done" ? "Prêt à générer vos posts" : `Question ${step} sur 3`}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 ml-auto">
          {([1, 2, 3] as const).map((s) => (
            <span
              key={s}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background:
                  step === "done" || s < step
                    ? "#10B981"
                    : s === step
                    ? "#34D399"
                    : "#2A2A32",
                transform: s === step ? "scale(1.25)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn("flex flex-col gap-2", msg.from === "user" ? "items-end" : "items-start")}
          >
            <div
              className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
              style={
                msg.from === "user"
                  ? { background: "#10B981", color: "#0F0F10", borderBottomRightRadius: "4px" }
                  : {
                      background: "#0D2B22",
                      color: "#F0F0F5",
                      borderBottomLeftRadius: "4px",
                      borderLeft: "2px solid #10B981",
                    }
              }
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
            </div>

            {/* Suggestion chips */}
            {msg.from === "agent" && msg.suggestions && msg.suggestions.length > 0 && step !== "done" && (
              <div className="flex flex-wrap gap-2 max-w-[90%]">
                {msg.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => submitAnswer(s)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-all"
                    style={{ border: "1px solid #2A2A32" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {agentTyping && (
          <div className="flex items-start">
            <div
              className="rounded-2xl"
              style={{
                borderBottomLeftRadius: "4px",
                background: "#0D2B22",
                borderLeft: "2px solid #10B981",
              }}
            >
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ borderTop: "1px solid #2A2A32", background: "#0A0A0F" }}
      >
        {step === "done" ? (
          <button
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2.5 py-3 font-semibold rounded-xl transition-all active:scale-[0.98]"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            <Zap size={16} fill="currentColor" />
            Générer mes posts
            <ChevronRight size={16} />
          </button>
        ) : (
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                step === 1
                  ? "Tes sujets de la semaine…"
                  : step === 2
                  ? "Ton de voix souhaité…"
                  : "Nombre de posts et format…"
              }
              rows={1}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm leading-relaxed resize-none focus:outline-none transition-all"
              style={{
                background: "#111115",
                border: "1px solid #2A2A32",
                color: "#F0F0F5",
                maxHeight: "120px",
                overflowY: "auto",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#10B981"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#2A2A32"; }}
              disabled={agentTyping}
            />
            <button
              onClick={() => submitAnswer(input)}
              disabled={!input.trim() || agentTyping}
              className="flex items-center justify-center w-10 h-10 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              style={{ background: "#10B981", color: "#0F0F10" }}
            >
              <Send size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
