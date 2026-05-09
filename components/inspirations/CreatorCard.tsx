"use client";

import { useEffect, useState } from "react";
import {
  MoreVertical,
  Trash2,
  ExternalLink,
  RefreshCw,
  FileText,
  Loader2,
} from "lucide-react";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { CreatorPostsModal } from "@/components/inspirations/CreatorPostsModal";
import type { Category, CreatorWithCount } from "@/types";

// ─── Category badge config ────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { label: string; className: string }> = {
  competitor:  { label: "Concurrent",   className: "bg-red-50 text-red-600 border-red-200" },
  top_creator: { label: "Top créateur", className: "bg-brand-50 text-brand-700 border-brand-200" },
  influencer:  { label: "Influenceur",  className: "bg-violet-50 text-violet-600 border-violet-200" },
};

// ─── Avatar gradients (deterministic by first char) ───────────────────────────

const AVATAR_GRADIENTS = [
  "from-brand-400 to-teal-500",
  "from-violet-400 to-indigo-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-sky-400 to-blue-500",
];

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const gradient = AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length];

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={44}
        height={44}
        className="w-11 h-11 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm shrink-0",
        gradient
      )}
    >
      {initials}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalState = {
  last_scraped_at: string | null;
  post_count: number;
  avatar_url: string | null;
};

type Props = {
  creator: CreatorWithCount;
  onDelete: (id: string) => void;
  onScrapeDone?: (update: { last_scraped_at: string | null; post_count: number; avatar_url: string | null }) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatorCard({ creator, onDelete, onScrapeDone }: Props) {
  const { showToast } = useToast();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [scraping,    setScraping]    = useState(false);
  const [runId,       setRunId]       = useState<string | null>(null);
  const [postsModal,  setPostsModal]  = useState(false);
  const [local,       setLocal]       = useState<LocalState>({
    last_scraped_at: creator.last_scraped_at,
    post_count:      creator.post_count,
    avatar_url:      creator.avatar_url,
  });

  useEffect(() => {
    if (!scraping) {
      setLocal({ last_scraped_at: creator.last_scraped_at, post_count: creator.post_count, avatar_url: creator.avatar_url });
    }
  }, [creator.last_scraped_at, creator.post_count, creator.avatar_url, scraping]);

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/creators/${creator.id}/scrape-status?runId=${runId}`);
        if (!res.ok) { setScraping(false); setRunId(null); return; }

        const data: { done: boolean; count?: number } = await res.json();
        if (data.done) {
          const statusRes = await fetch(`/api/creators/${creator.id}/status`);
          if (statusRes.ok) {
            const status: { last_scraped_at: string | null; post_count: number; avatar_url: string | null } = await statusRes.json();
            setLocal({ last_scraped_at: status.last_scraped_at, post_count: status.post_count, avatar_url: status.avatar_url });
            onScrapeDone?.({ last_scraped_at: status.last_scraped_at, post_count: status.post_count, avatar_url: status.avatar_url });
          }
          showToast(`Scraping terminé — ${data.count ?? 0} nouveau${(data.count ?? 0) !== 1 ? "x" : ""} post${(data.count ?? 0) !== 1 ? "s" : ""}`);
          setScraping(false);
          setRunId(null);
        }
      } catch {
        // ignore poll errors
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [runId, creator.id]);

  async function handleScrape() {
    setScraping(true);
    setMenuOpen(false);
    showToast("Scraping lancé");
    try {
      const res = await fetch(`/api/creators/${creator.id}/scrape`, { method: "POST" });
      if (!res.ok) { setScraping(false); return; }
      const data: { runId: string } = await res.json();
      setRunId(data.runId);
    } catch {
      setScraping(false);
    }
  }

  const badge = creator.category ? CATEGORY_CONFIG[creator.category] : null;

  return (
    <>
      <div className="card-hover p-4 flex flex-col gap-4 group">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <Avatar name={creator.name} avatarUrl={local.avatar_url} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900 text-sm leading-tight truncate">
                  {creator.name}
                </p>
                <a
                  href={creator.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-zinc-400 hover:text-brand-500 transition-colors truncate block"
                >
                  {creator.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </div>

              {/* 3-dot menu */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1 rounded-md text-zinc-300 hover:text-zinc-600 hover:bg-zinc-100 transition-all opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={15} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-6 z-20 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 overflow-hidden">
                      <button
                        onClick={() => { setPostsModal(true); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                      >
                        <FileText size={14} className="text-zinc-400" />
                        Voir les posts
                      </button>
                      <a
                        href={creator.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
                      >
                        <ExternalLink size={14} className="text-zinc-400" />
                        Profil LinkedIn
                      </a>
                      <div className="my-1 border-t border-zinc-100" />
                      <button
                        onClick={() => { onDelete(creator.id); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Category badge */}
            {badge && (
              <span
                className={cn(
                  "inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  badge.className
                )}
              >
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {creator.follower_count != null && creator.follower_count > 0 && (
              <span>{formatNumber(creator.follower_count)} abonnés</span>
            )}
            <span>
              <span className="text-zinc-700 font-semibold">{local.post_count}</span>{" "}
              post{local.post_count !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[11px] text-zinc-300">
            {local.last_scraped_at ? timeAgo(local.last_scraped_at) : "Jamais scrapé"}
          </span>
        </div>

        {/* Scrape button */}
        <button
          onClick={handleScrape}
          disabled={scraping}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-[0.98]",
            scraping
              ? "border-brand-200 bg-brand-50 text-brand-600 cursor-not-allowed"
              : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-100"
          )}
        >
          {scraping ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Scraping en cours…
            </>
          ) : (
            <>
              <RefreshCw size={12} />
              Scraper
            </>
          )}
        </button>
      </div>

      {postsModal && (
        <CreatorPostsModal
          creatorId={creator.id}
          creatorName={creator.name}
          onClose={() => setPostsModal(false)}
        />
      )}
    </>
  );
}
