"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LockedPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/unlock", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/onboarding");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Mot de passe incorrect.");
        setPassword("");
      }
    } catch {
      setError("Erreur réseau, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg">
              <Zap size={28} className="text-white" fill="currentColor" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-white border border-zinc-200 shadow-sm flex items-center justify-center">
              <Lock size={12} className="text-zinc-400" />
            </div>
          </div>
        </div>

        <h1 className="text-center text-xl font-semibold text-zinc-900 mb-1">
          Content Agent
        </h1>
        <p className="text-center text-sm text-zinc-400 mb-8">
          Entrez le mot de passe pour accéder à l&apos;application.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoFocus
            className={cn(
              "w-full bg-white border rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 text-center tracking-widest",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all",
              error ? "border-red-300" : "border-zinc-200"
            )}
          />

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-500 px-1">
              <AlertCircle size={13} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Vérification…
              </>
            ) : (
              "Accéder"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
