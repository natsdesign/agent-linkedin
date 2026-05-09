"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Zap, Send, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Flow definition ──────────────────────────────────────────────────────────

type Step = {
  id: string;
  message: string;
  type: "buttons" | "text" | "textarea";
  options?: string[];
};

const PERSONAL_STEPS: Step[] = [
  {
    id: "account_type",
    message:
      "Bonjour ! Je suis ton agent de contenu LinkedIn. Pour créer du contenu qui te ressemble vraiment, j'ai besoin de te connaître.\n\nC'est pour ton compte personnel ou tu gères des comptes clients ?",
    type: "buttons",
    options: ["Mon compte", "Comptes clients"],
  },
  {
    id: "job",
    message: "Parfait. En quelques mots, tu fais quoi comme métier ?",
    type: "text",
  },
  {
    id: "audience",
    message: "À qui tu t'adresses sur LinkedIn ? Qui est ton client idéal ?",
    type: "text",
  },
  {
    id: "style",
    message: "Quel est ton style naturel ? Tu es plutôt...",
    type: "buttons",
    options: [
      "Expert qui éduque",
      "Entrepreneur qui partage son parcours",
      "Créatif qui inspire",
      "Consultant direct",
    ],
  },
  {
    id: "goal",
    message: "Quel est ton objectif principal sur LinkedIn ?",
    type: "buttons",
    options: ["Notoriété", "Générer des leads", "Recruter", "Personal branding"],
  },
  {
    id: "frequency",
    message: "Tu veux poster combien de fois par semaine ?",
    type: "buttons",
    options: ["3x", "5x", "7x"],
  },
  {
    id: "example",
    message:
      "Dernière question — donne-moi un exemple de post que tu as fait ou que tu aimerais faire. Même une idée vague.",
    type: "textarea",
  },
];

const CLIENT_STEPS: Step[] = [
  {
    id: "account_type",
    message:
      "Bonjour ! Je suis ton agent de contenu LinkedIn. Pour créer du contenu qui te ressemble vraiment, j'ai besoin de te connaître.\n\nC'est pour ton compte personnel ou tu gères des comptes clients ?",
    type: "buttons",
    options: ["Mon compte", "Comptes clients"],
  },
  {
    id: "client_name",
    message:
      "Super, tu vas pouvoir gérer plusieurs comptes depuis un seul endroit. Commençons par ton premier client. C'est qui ?",
    type: "text",
  },
  {
    id: "job",
    message: "Il fait quoi comme métier ?",
    type: "text",
  },
  {
    id: "audience",
    message: "À qui il s'adresse sur LinkedIn ?",
    type: "text",
  },
  {
    id: "style",
    message: "Comment il parle ? Son style naturel ?",
    type: "buttons",
    options: [
      "Expert qui éduque",
      "Entrepreneur qui partage son parcours",
      "Créatif qui inspire",
      "Consultant direct",
    ],
  },
  {
    id: "goal",
    message: "Son objectif principal ?",
    type: "buttons",
    options: ["Notoriété", "Générer des leads", "Recruter", "Personal branding"],
  },
  {
    id: "example",
    message:
      "Un exemple de contenu qu'il a déjà posté ou qui lui ressemble ?",
    type: "textarea",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: "agent" | "user";
  text: string;
};

type Phase = "chat" | "generating" | "done" | "edit";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editAccountId = searchParams.get("accountId");

  const [phase, setPhase] = useState<Phase>("chat");
  const [steps, setSteps] = useState<Step[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [generatedAccount, setGeneratedAccount] = useState<{ id: string; name: string } | null>(null);
  const [summary, setSummary] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Start with the first question
    const initialSteps = PERSONAL_STEPS;
    setSteps(initialSteps);
    setMessages([{ role: "agent", text: initialSteps[0].message }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const currentStep = steps[currentStepIndex];

  function addUserMessage(text: string) {
    setMessages((prev) => [...prev, { role: "user", text }]);
  }

  function addAgentMessage(text: string) {
    setMessages((prev) => [...prev, { role: "agent", text }]);
  }

  function handleAnswer(answer: string) {
    addUserMessage(answer);
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // If this was the account_type question, switch step list
    if (currentStep.id === "account_type") {
      const nextSteps = answer === "Comptes clients" ? CLIENT_STEPS : PERSONAL_STEPS;
      setSteps(nextSteps);
      // Move to next step in the new list (index 1)
      const nextStep = nextSteps[1];
      setTimeout(() => {
        addAgentMessage(nextStep.message);
        setCurrentStepIndex(1);
      }, 300);
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setTimeout(() => {
        addAgentMessage(steps[nextIndex].message);
        setCurrentStepIndex(nextIndex);
        setInputValue("");
      }, 300);
    } else {
      // All questions answered — generate profile
      setTimeout(() => generateProfile(newAnswers), 300);
    }
  }

  function handleTextSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setInputValue("");
    handleAnswer(trimmed);
  }

  async function generateProfile(allAnswers: string[]) {
    setPhase("generating");
    addAgentMessage("Je génère ton profil de contenu...");

    try {
      const res = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: allAnswers,
          accountId: editAccountId ?? undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur de génération");
      }

      const { account, summary: sum } = await res.json();

      // Set active account cookie
      await fetch("/api/accounts/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });

      setGeneratedAccount(account);
      setSummary(Array.isArray(sum) ? sum : []);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      setPhase("chat");
    }
  }

  function handleEdit() {
    setPhase("edit");
    setAnswers([]);
    setCurrentStepIndex(0);
    setSteps(PERSONAL_STEPS);
    setMessages([{ role: "agent", text: PERSONAL_STEPS[0].message }]);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-4" style={{ background: "#0F0F10" }}>
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-500 shadow-lg">
          <Zap size={18} className="text-white" fill="currentColor" />
        </div>
        <p className="text-zinc-500 text-sm">Configurer un compte</p>
      </div>

      {/* Chat window */}
      <div className="w-full max-w-[580px] flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line",
              msg.role === "agent"
                ? "self-start border-l-2 border-emerald-500 text-zinc-200"
                : "self-end text-zinc-100 ml-auto"
            )}
            style={
              msg.role === "agent"
                ? { background: "#1A1A1F" }
                : { background: "#0D2B22" }
            }
          >
            {msg.text}
          </div>
        ))}

        {/* Generating indicator */}
        {phase === "generating" && (
          <div className="self-start flex items-center gap-2 px-4 py-3 rounded-2xl text-sm text-zinc-400" style={{ background: "#1A1A1F" }}>
            <Loader2 size={14} className="animate-spin text-emerald-500" />
            Analyse en cours...
          </div>
        )}

        {/* Done state */}
        {phase === "done" && generatedAccount && (
          <div className="self-start px-4 py-4 rounded-2xl text-sm text-zinc-200 w-full" style={{ background: "#1A1A1F", borderLeft: "2px solid #10b981" }}>
            <p className="text-emerald-400 font-medium mb-3">
              Ton profil est prêt ! Voici ce que j'ai compris de toi :
            </p>
            <ul className="space-y-2">
              {summary.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-zinc-300">
                  <span className="text-emerald-500 mt-0.5 shrink-0">•</span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => router.push("/inspirations")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
              >
                C'est parfait, on y va
                <ArrowRight size={14} />
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-all"
              >
                Modifier quelque chose
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="self-start px-4 py-3 rounded-2xl text-sm text-red-400" style={{ background: "#1A1A1F" }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {phase === "chat" && currentStep && (
        <div className="w-full max-w-[580px] mt-4">
          {currentStep.type === "buttons" && currentStep.options && (
            <div className="flex flex-wrap gap-2">
              {currentStep.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-200 border border-zinc-700 hover:border-emerald-500 hover:text-emerald-400 transition-all"
                  style={{ background: "#1A1A1F" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {currentStep.type === "text" && (
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                placeholder="Tape ta réponse..."
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none border border-zinc-700 focus:border-emerald-500 transition-all"
                style={{ background: "#1A1A1F" }}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!inputValue.trim()}
                className="px-3 py-2.5 rounded-xl text-zinc-400 hover:text-emerald-400 border border-zinc-700 hover:border-emerald-500 transition-all disabled:opacity-40"
                style={{ background: "#1A1A1F" }}
              >
                <Send size={16} />
              </button>
            </div>
          )}

          {currentStep.type === "textarea" && (
            <div className="flex flex-col gap-2">
              <textarea
                autoFocus
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Tape ta réponse..."
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 outline-none border border-zinc-700 focus:border-emerald-500 transition-all resize-none leading-relaxed"
                style={{ background: "#1A1A1F" }}
              />
              <button
                onClick={handleTextSubmit}
                disabled={!inputValue.trim()}
                className="self-end flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-zinc-200 border border-zinc-700 hover:border-emerald-500 hover:text-emerald-400 transition-all disabled:opacity-40"
                style={{ background: "#1A1A1F" }}
              >
                Envoyer
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
