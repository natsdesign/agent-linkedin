"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
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
import type { Category, CreatorWithCount } from "@/types";

// ─── Category badge config ────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  Category,
  { label: string; className: string }
> = {
  competitor:  { label: "Concurrent",     className: "bg-red-500/15 text-red-400 border-red-500/25" },
  top_creator: { label: "Top créateur",   className: "bg-brand-500/15 text-brand-400 border-brand-500/25" },
  influencer:  { label: "Influenceur",    className: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={44}
        height={44}
        className="w-11 h-11 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
      {initials}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type LocalState = {
  last_scraped_at: string | null;
  post_count: number;
};

type Props = {
  creator: CreatorWithCount;
  onDelete: (id: string) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatorCard({ creator, onDelete }: Props) {
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [local, setLocal] = useState<LocalState>({
    last_scraped_at: creator.last_scraped_at,
    post_count: creator.post_count,
  });
  const prevScrapedAt = useRef(creator.last_scraped_at);

  // Sync parent data when not actively scraping
  useEffect(() => {
    if (!scraping) {
      setLocal({ last_scraped_at: creator.last_scraped_at, post_count: creator.post_count });
    }
  }, [creator.last_scraped_at, creator.post_count, scraping]);

  // Poll status every 5s while scraping
  useEffect(() => {
    if (!scraping) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/creators/${creator.id}/status`);
        if (!res.ok) return;
        const data: { last_scraped_at: string | null; post_count: number } = await res.json();

        const changed =
          data.last_scraped_at !== null &&
          data.last_scraped_at !== prevScrapedAt.current;

        if (changed) {
          setLocal({ last_scraped_at: data.last_scraped_at, post_count: data.post_count });
          setScraping(false);
        }
      } catch {
        // silently ignore poll errors
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [scraping, creator.id]);

  async function handleScrape() {
    prevScrapedAt.current = local.last_scraped_at;
    setScraping(true);
    setMenuOpen(false);
    showToast("Scraping lancé");

    // Fire-and-forget — polling detects completion via last_scraped_at change
    fetch(`/api/creators/${creator.id}/scrape`, { method: "POST" })
      .then((res) => { if (!res.ok) setScraping(false); })
      .catch(() => setScraping(false));
  }

  const badge = creator.category ? CATEGORY_CONFIG[creator.category] : null;

  return (
    <div className="relative glass rounded-xl p-4 hover:bg-white/[0.06] transition-colors group flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <Avatar name={creator.name} avatarUrl={creator.avatar_url} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm leading-tight truncate">
                {creator.name}
              </p>
              <a
                href={creator.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-brand-400 transition-colors truncate block"
              >
                {creator.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </div>

            {/* 3-dot menu */}
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
              >
                <MoreVertical size={15} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-6 z-20 w-44 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 overflow-hidden">
                    <a
                      href={`/inspirations/${creator.id}`}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/8 transition-colors"
                    >
                      <FileText size={14} className="text-gray-500" />
                      Voir les posts
                    </a>
                    <a
                      href={creator.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/8 transition-colors"
                    >
                      <ExternalLink size={14} className="text-gray-500" />
                      Profil LinkedIn
                    </a>
                    <div className="my-1 border-t border-gray-800" />
                    <button
                      onClick={() => { onDelete(creator.id); setMenuOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {creator.follower_count != null && creator.follower_count > 0 && (
            <span>{formatNumber(creator.follower_count)} abonnés</span>
          )}
          <span>
            <span className="text-gray-300 font-medium">{local.post_count}</span> post{local.post_count !== 1 ? "s" : ""}
          </span>
        </div>

        <span className="text-[11px] text-gray-600">
          {local.last_scraped_at ? timeAgo(local.last_scraped_at) : "Jamais scrapé"}
        </span>
      </div>

      {/* Scrape button */}
      <button
        onClick={handleScrape}
        disabled={scraping}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold border transition-all",
          scraping
            ? "border-brand-500/30 bg-brand-600/10 text-brand-400 cursor-not-allowed"
            : "border-gray-700 bg-white/5 text-gray-400 hover:text-white hover:border-gray-500 hover:bg-white/10"
        )}
      >
        {scraping ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Scraping en cours…
          </>
        ) : (
          <>
            <RefreshCw size={13} />
            Scraper
          </>
        )}
      </button>
    </div>
  );
}
