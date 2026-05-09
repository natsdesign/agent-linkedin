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

const CATEGORY_CONFIG: Record<Category, { label: string; bg: string; color: string }> = {
  competitor:  { label: "Concurrent",   bg: "#450A0A", color: "#EF4444" },
  top_creator: { label: "Top créateur", bg: "#064E3B", color: "#10B981" },
  influencer:  { label: "Influenceur",  bg: "#2D1B69", color: "#A78BFA" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const [imgError, setImgError] = useState(false);

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (avatarUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[#8B8B9E] font-semibold text-xs shrink-0"
      style={{ background: "#1A1A1F", border: "1px solid #2A2A32" }}
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
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [scraping,   setScraping]   = useState(false);
  const [runId,      setRunId]      = useState<string | null>(null);
  const [postsModal, setPostsModal] = useState(false);
  const [local,      setLocal]      = useState<LocalState>({
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
      <div
        className="group flex flex-col gap-3 p-4 rounded-[10px] transition-all duration-150"
        style={{
          background: "#1A1A1F",
          border: "1px solid #2A2A32",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#10B981";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(16,185,129,0.1)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#2A2A32";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Top row */}
        <div className="flex items-start gap-3">
          <Avatar name={creator.name} avatarUrl={local.avatar_url} />

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <p className="font-semibold text-[#F0F0F5] text-sm leading-tight truncate">
                  {creator.name}
                </p>
                <a
                  href={creator.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8B8B9E] hover:text-[#10B981] transition-colors truncate block"
                >
                  {creator.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
              </div>

              {/* 3-dot menu */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="p-1 rounded-md text-[#55555F] hover:text-[#8B8B9E] hover:bg-[#222228] transition-all opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={15} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div
                      className="absolute right-0 top-6 z-20 w-44 rounded-[10px] py-1 overflow-hidden"
                      style={{
                        background: "#1A1A1F",
                        border: "1px solid #2A2A32",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      }}
                    >
                      <button
                        onClick={() => { setPostsModal(true); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#222228] transition-colors"
                      >
                        <FileText size={13} className="text-[#55555F]" />
                        Voir les posts
                      </button>
                      <a
                        href={creator.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#222228] transition-colors"
                      >
                        <ExternalLink size={13} className="text-[#55555F]" />
                        Profil LinkedIn
                      </a>
                      <div className="my-1" style={{ borderTop: "1px solid #2A2A32" }} />
                      <button
                        onClick={() => { onDelete(creator.id); setMenuOpen(false); }}
                        className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-[#EF4444] hover:bg-[#450A0A] transition-colors"
                      >
                        <Trash2 size={13} />
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
                className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: "1px solid #2A2A32" }}
        >
          <div className="flex items-center gap-3 text-xs text-[#55555F]">
            {creator.follower_count != null && creator.follower_count > 0 && (
              <span>{formatNumber(creator.follower_count)} abn.</span>
            )}
            <span>
              <span className="text-[#F0F0F5] font-semibold">{local.post_count}</span>{" "}
              post{local.post_count !== 1 ? "s" : ""}
            </span>
          </div>
          <span className="text-[11px] text-[#55555F]">
            {local.last_scraped_at ? timeAgo(local.last_scraped_at) : "Jamais scrapé"}
          </span>
        </div>

        {/* Scrape button */}
        <button
          onClick={handleScrape}
          disabled={scraping}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all duration-150 active:scale-[0.98]",
            scraping
              ? "cursor-not-allowed"
              : "cursor-pointer"
          )}
          style={
            scraping
              ? { background: "#0D2B22", color: "#10B981", border: "1px solid #064E3B" }
              : { background: "transparent", color: "#8B8B9E", border: "1px solid #2A2A32" }
          }
          onMouseEnter={(e) => {
            if (!scraping) {
              (e.currentTarget as HTMLButtonElement).style.color = "#F0F0F5";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#3A3A45";
              (e.currentTarget as HTMLButtonElement).style.background = "#222228";
            }
          }}
          onMouseLeave={(e) => {
            if (!scraping) {
              (e.currentTarget as HTMLButtonElement).style.color = "#8B8B9E";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#2A2A32";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }
          }}
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
