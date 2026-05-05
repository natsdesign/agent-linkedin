"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronLeft, ChevronRight, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type FormData = {
  niche: string;
  target_audience: string;
  posting_frequency: number;
  tone: string;
  goals: string[];
  context: string;
};

const INITIAL: FormData = {
  niche:             "",
  target_audience:   "",
  posting_frequency: 5,
  tone:              "",
  goals:             [],
  context:           "",
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS = [
  { label: "3 / semaine", value: 3 },
  { label: "5 / semaine", value: 5 },
  { label: "7 / semaine", value: 7 },
];

const GOALS_OPTIONS = [
  "Notoriété",
  "Génération de leads",
  "Ventes",
  "Personal branding",
];

const STEPS = ["Ton profil", "Ton style", "Ton contexte"];

// ─── Sub-components ──────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [checking,   setChecking]   = useState(true);
  const [step,       setStep]       = useState(0);
  const [form,       setForm]       = useState<FormData>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) router.replace("/inspirations");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleGoal(goal: string) {
    set(
      "goals",
      form.goals.includes(goal)
        ? form.goals.filter((g) => g !== goal)
        : [...form.goals, goal]
    );
  }

  function canAdvance() {
    if (step === 0) return form.niche.trim() !== "" && form.target_audience.trim() !== "";
    if (step === 1) return form.tone.trim() !== "" && form.goals.length > 0;
    return true;
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Erreur lors de l'enregistrement.");
      }
      router.push("/inspirations");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur s'est produite.");
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const stepContent = [
    // Step 1 — Ton profil
    <div key="step1" className="space-y-5">
      <Field label="Ta niche" hint="Le domaine sur lequel tu crées du contenu.">
        <input
          type="text"
          value={form.niche}
          onChange={(e) => set("niche", e.target.value)}
          placeholder="ex: marketing digital, immobilier, coaching..."
          className={inputCls}
          autoFocus
        />
      </Field>
      <Field label="Ton audience cible" hint="Décris le profil de tes lecteurs idéaux.">
        <input
          type="text"
          value={form.target_audience}
          onChange={(e) => set("target_audience", e.target.value)}
          placeholder="ex: entrepreneurs 30-45 ans, PME en croissance..."
          className={inputCls}
        />
      </Field>
      <Field label="Fréquence de publication">
        <div className="flex gap-3">
          {FREQUENCY_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => set("posting_frequency", value)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all",
                form.posting_frequency === value
                  ? "bg-brand-50 border-brand-300 text-brand-700"
                  : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>
    </div>,

    // Step 2 — Ton style
    <div key="step2" className="space-y-5">
      <Field label="Ton de voix" hint="Comment tu t'exprimes dans tes posts.">
        <input
          type="text"
          value={form.tone}
          onChange={(e) => set("tone", e.target.value)}
          placeholder="ex: expert, inspirant, direct, avec humour..."
          className={inputCls}
          autoFocus
        />
      </Field>
      <Field label="Tes objectifs" hint="Sélectionne tout ce qui s'applique.">
        <div className="grid grid-cols-2 gap-2.5 mt-1">
          {GOALS_OPTIONS.map((goal) => {
            const active = form.goals.includes(goal);
            return (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={cn(
                  "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm border transition-all text-left",
                  active
                    ? "bg-brand-50 border-brand-300 text-brand-700"
                    : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-4 h-4 rounded-full border shrink-0 transition-all",
                    active ? "bg-brand-500 border-brand-500" : "border-zinc-300"
                  )}
                >
                  {active && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                {goal}
              </button>
            );
          })}
        </div>
      </Field>
    </div>,

    // Step 3 — Ton contexte
    <div key="step3" className="space-y-5">
      <Field
        label="Contexte supplémentaire pour l'agent"
        hint="Plus tu es précis, meilleurs seront les posts générés."
      >
        <textarea
          value={form.context}
          onChange={(e) => set("context", e.target.value)}
          placeholder={`ex: je suis consultant SEO depuis 5 ans, j'accompagne des e-commerçants. Je veux éviter de parler de politique et de religion. Mon ton habituel est assez direct et factuel, avec parfois de l'humour.`}
          rows={7}
          className={cn(inputCls, "resize-none leading-relaxed")}
          autoFocus
        />
      </Field>
    </div>,
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg">
            <Zap size={22} className="text-white" fill="currentColor" />
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all",
                    i < step
                      ? "bg-brand-500 border-brand-500 text-white"
                      : i === step
                      ? "border-brand-400 text-brand-600 bg-brand-50"
                      : "border-zinc-200 text-zinc-400 bg-white"
                  )}
                >
                  {i < step ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    i === step ? "text-zinc-700" : "text-zinc-400"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-20 h-px mx-2 mb-5 transition-all",
                    i < step ? "bg-brand-400" : "bg-zinc-200"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="card p-7">
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">{STEPS[step]}</h2>
          <p className="text-sm text-zinc-400 mb-6">
            {step === 0 && "Définis ton positionnement pour personnaliser l'agent."}
            {step === 1 && "L'agent adaptera le ton et les formats à tes ambitions."}
            {step === 2 && "Ces infos seront injectées dans chaque génération de contenu."}
          </p>

          {stepContent[step]}

          {error && (
            <p className="mt-4 text-sm text-red-500 text-center">{error}</p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-7">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
              >
                <ChevronLeft size={15} />
                Retour
              </button>
            )}
            <button
              type="button"
              disabled={!canAdvance() || submitting}
              onClick={() => {
                if (step < STEPS.length - 1) setStep(step + 1);
                else handleSubmit();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Enregistrement…
                </>
              ) : step < STEPS.length - 1 ? (
                <>
                  Suivant
                  <ChevronRight size={15} />
                </>
              ) : (
                <>
                  <Check size={15} />
                  Terminer
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-300 mt-4">
          Étape {step + 1} sur {STEPS.length}
        </p>
      </div>
    </div>
  );
}
