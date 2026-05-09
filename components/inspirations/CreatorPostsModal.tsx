"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

type ScrapedPost = {
  id: string;
  content: string;
  published_at: string | null;
  likes: number;
  comments: number;
  hook_type: string | null;
  format: string | null;
  post_url: string | null;
};

type Props = {
  creatorId: string;
  creatorName: string;
  onClose: () => void;
};

export function CreatorPostsModal({ creatorId, creatorName, onClose }: Props) {
  const [posts, setPosts] = useState<ScrapedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/creators/${creatorId}/posts?page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [creatorId, page]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="font-semibold text-zinc-900">Posts de {creatorName}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{total} post{total !== 1 ? "s" : ""} scrapé{total !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">Chargement…</div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-zinc-400 text-sm">Aucun post scrapé pour ce créateur</p>
              <p className="text-zinc-300 text-xs">Lance un scraping depuis la carte créateur</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {posts.map((p) => (
                <div key={p.id} className="px-6 py-4 hover:bg-zinc-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-zinc-700 leading-relaxed flex-1">
                      {p.content.slice(0, 200)}{p.content.length > 200 ? "…" : ""}
                    </p>
                    {p.post_url && (
                      <a
                        href={p.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-300 hover:text-brand-500 shrink-0 transition-colors mt-0.5"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-zinc-400">{p.published_at?.slice(0, 10) ?? "—"}</span>
                    <span className="text-xs text-zinc-500">👍 {p.likes}</span>
                    <span className="text-xs text-zinc-500">💬 {p.comments}</span>
                    {p.hook_type && (
                      <span className="px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[11px] font-medium border border-brand-100">
                        {p.hook_type}
                      </span>
                    )}
                    {p.format && (
                      <span className="px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 text-[11px] font-medium border border-violet-100">
                        {p.format}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-100 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
              Précédent
            </button>
            <span className="text-xs text-zinc-400">Page {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-30 transition-colors"
            >
              Suivant
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
