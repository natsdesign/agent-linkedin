"use client";

import { useState } from "react";
import { X, UserPlus, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, linkedinUrl: string, category: Category) => Promise<void>;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "competitor",  label: "Concurrent" },
  { value: "top_creator", label: "Top créateur" },
  { value: "influencer",  label: "Influenceur" },
];

const inputCls = cn(
  "w-full bg-white/5 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600",
  "focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition-all"
);

export function AddCreatorModal({ open, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [category, setCategory] = useState<Category>("top_creator");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function reset() {
    setName("");
    setLinkedinUrl("");
    setCategory("top_creator");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function isValidLinkedInUrl(url: string) {
    return /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9\-_%]+\/?/.test(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Le nom est requis."); return; }
    if (!isValidLinkedInUrl(linkedinUrl.trim())) {
      setError("URL invalide. Format attendu : https://linkedin.com/in/username");
      return;
    }

    setLoading(true);
    try {
      await onAdd(name.trim(), linkedinUrl.trim(), category);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur s'est produite.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
              <UserPlus size={17} className="text-brand-400" />
            </div>
            <h2 className="font-semibold text-white">Ajouter un créateur</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              Nom du créateur
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Marie Dupont"
              className={inputCls}
              autoFocus
            />
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              URL LinkedIn
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/username"
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
              Catégorie
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className={cn(
                  inputCls,
                  "appearance-none cursor-pointer pr-9"
                )}
              >
                {CATEGORIES.map(({ value, label }) => (
                  <option key={value} value={value} className="bg-gray-900">
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 hover:bg-white/5 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" />Ajout…</>
              ) : (
                <><UserPlus size={14} />Ajouter</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
