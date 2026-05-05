"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import type { GeneratedPost, PostStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FR_MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const FR_DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
type ViewMode = "week" | "month";

const STATUS_CFG: Record<PostStatus, { label: string; dot: string; badge: string }> = {
  draft:     { label: "Brouillon", dot: "bg-gray-500",    badge: "text-gray-400 bg-gray-500/15 border-gray-500/25" },
  validated: { label: "Validé",    dot: "bg-brand-500",   badge: "text-brand-400 bg-brand-600/15 border-brand-500/25" },
  scheduled: { label: "Planifié",  dot: "bg-orange-400",  badge: "text-orange-400 bg-orange-400/15 border-orange-400/25" },
  published: { label: "Publié",    dot: "bg-emerald-400", badge: "text-emerald-400 bg-emerald-500/15 border-emerald-500/25" },
};

const FORMAT_DOT: Record<string, string> = {
  liste: "bg-blue-400", storytelling: "bg-purple-400",
  carrousel: "bg-amber-400", court: "bg-green-400", texte: "bg-gray-500",
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function weekDays(anchor: Date): Date[] {
  const mon = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

function monthGrid(anchor: Date): Date[][] {
  const s = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const e = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: s, end: e });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

function dateId(d: Date) { return format(d, "yyyy-MM-dd"); }

function toUTC9(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0)).toISOString();
}

// ─── DraggablePostCard ────────────────────────────────────────────────────────

type CardProps = {
  post: GeneratedPost;
  onClick: () => void;
  onPublish?: () => void;
};

function DraggablePostCard({ post, onClick, onPublish }: CardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: post.id });
  const cfg = STATUS_CFG[post.status] ?? STATUS_CFG.draft;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-gray-700 bg-gray-900/80 p-2.5 cursor-grab active:cursor-grabbing select-none transition-all",
        isDragging ? "opacity-30" : "hover:border-gray-600 hover:bg-gray-900"
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <p className="text-[11px] text-gray-200 leading-relaxed line-clamp-2">
        {post.content.slice(0, 80)}{post.content.length > 80 ? "…" : ""}
      </p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {post.format && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/8 text-gray-500">
            {post.format}
          </span>
        )}
        <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium border", cfg.badge)}>
          {cfg.label}
        </span>
      </div>
      {post.status === "scheduled" && onPublish && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onPublish(); }}
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/20 transition-colors"
        >
          <Check size={10} strokeWidth={3} />
          Marquer publié
        </button>
      )}
    </div>
  );
}

// Overlay preview (shown during drag)
function DragPreview({ post }: { post: GeneratedPost }) {
  return (
    <div className="w-44 rounded-lg border border-brand-500/50 bg-gray-900 p-2.5 shadow-2xl rotate-1 opacity-95">
      <p className="text-[11px] text-gray-200 line-clamp-2">{post.content.slice(0, 80)}</p>
      {post.format && (
        <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] bg-brand-600/30 text-brand-400">
          {post.format}
        </span>
      )}
    </div>
  );
}

// ─── Day column (week view) ───────────────────────────────────────────────────

function DayColumn({
  date, posts, onPostClick, onPublish,
}: {
  date: Date;
  posts: GeneratedPost[];
  onPostClick: (p: GeneratedPost) => void;
  onPublish: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateId(date) });
  const today = isToday(date);
  const dow = (date.getDay() + 6) % 7;

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-gray-800 last:border-r-0 h-full overflow-hidden">
      {/* Header */}
      <div className={cn("shrink-0 px-2 pt-3 pb-2.5 border-b border-gray-800 text-center", today && "bg-brand-600/5")}>
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{FR_DAYS[dow]}</p>
        <p className={cn("text-xl font-bold leading-tight", today ? "text-brand-400" : "text-gray-200")}>
          {format(date, "d")}
        </p>
        {today && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mx-auto mt-1" />}
      </div>
      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-1.5 space-y-1.5 transition-colors min-h-0", isOver && "bg-brand-600/8")}
      >
        {posts.map((p) => (
          <DraggablePostCard
            key={p.id}
            post={p}
            onClick={() => onPostClick(p)}
            onPublish={p.status === "scheduled" ? () => onPublish(p.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Unscheduled column ───────────────────────────────────────────────────────

function UnscheduledColumn({
  posts, onPostClick,
}: {
  posts: GeneratedPost[];
  onPostClick: (p: GeneratedPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unscheduled" });

  return (
    <div className="w-48 shrink-0 flex flex-col border-r border-gray-800 h-full overflow-hidden">
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-500">Non planifiés</p>
        <p className="text-[11px] text-gray-700 mt-0.5">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0 transition-colors", isOver && "bg-brand-600/8")}
      >
        {posts.length === 0 ? (
          <p className="text-[11px] text-gray-700 text-center pt-6 px-2 leading-relaxed">
            Tous vos posts<br />sont planifiés ✓
          </p>
        ) : (
          posts.map((p) => (
            <DraggablePostCard key={p.id} post={p} onClick={() => onPostClick(p)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Droppable day cell (month view) ─────────────────────────────────────────

function DayCell({
  date, posts, isCurrentMonth, isSelected, onDayClick, onPostClick,
}: {
  date: Date;
  posts: GeneratedPost[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  onDayClick: () => void;
  onPostClick: (p: GeneratedPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateId(date) });
  const today = isToday(date);

  return (
    <div
      ref={setNodeRef}
      onClick={onDayClick}
      className={cn(
        "min-h-[88px] p-1.5 border-b border-r border-gray-800 cursor-pointer transition-colors",
        !isCurrentMonth && "bg-gray-900/60",
        isOver && "bg-brand-600/8",
        isSelected && "ring-1 ring-inset ring-brand-500/40 bg-brand-600/5",
        "hover:bg-white/[0.02]"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1",
          today ? "bg-brand-600 text-white" : isCurrentMonth ? "text-gray-300" : "text-gray-700"
        )}
      >
        {format(date, "d")}
      </span>
      <div className="space-y-0.5">
        {posts.slice(0, 3).map((p) => (
          <div
            key={p.id}
            onClick={(e) => { e.stopPropagation(); onPostClick(p); }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-400 bg-gray-800/70 hover:bg-gray-700/70 truncate transition-colors cursor-pointer"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", FORMAT_DOT[p.format ?? "texte"] ?? "bg-gray-500")} />
            <span className="truncate">{p.content.slice(0, 20)}</span>
          </div>
        ))}
        {posts.length > 3 && (
          <p className="text-[10px] text-gray-600 px-1">+{posts.length - 3} autres</p>
        )}
      </div>
    </div>
  );
}

// ─── Post detail modal ────────────────────────────────────────────────────────

function PostDetailModal({
  post, onClose, onUpdate, onDelete,
}: {
  post: GeneratedPost;
  onClose: () => void;
  onUpdate: (p: GeneratedPost) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cfg = STATUS_CFG[post.status] ?? STATUS_CFG.draft;

  async function patch(body: Partial<GeneratedPost>) {
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) onUpdate({ ...post, ...body });
  }

  async function handleSave() {
    setSaving(true);
    await patch({ content: editContent });
    setEditing(false);
    setSaving(false);
  }

  async function handlePublish() {
    setPublishing(true);
    await patch({ status: "published" });
    setPublishing(false);
  }

  async function handleDelete() {
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onDelete(post.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {post.format && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-white/8 text-gray-400 shrink-0">{post.format}</span>
            )}
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border shrink-0", cfg.badge)}>
              {cfg.label}
            </span>
            {post.subject && (
              <span className="text-sm text-gray-500 truncate">{post.subject}</span>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/10 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {post.hook && (
            <div className="p-3 bg-brand-600/8 border border-brand-500/20 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-brand-400 font-semibold mb-1">Accroche</p>
              <p className="text-sm text-gray-300">{post.hook}</p>
            </div>
          )}

          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              autoFocus
              className="w-full bg-white/5 border border-gray-700 rounded-xl p-3.5 text-sm text-white leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500/40 transition-all"
            />
          ) : (
            <div className="p-3.5 bg-white/3 border border-gray-800 rounded-xl">
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          )}

          {post.cta && (
            <div className="p-3 bg-gray-800/60 border border-gray-700 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-1">CTA</p>
              <p className="text-sm text-gray-400">{post.cta}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-800 shrink-0">
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setEditContent(post.content); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-gray-400 border border-gray-700 hover:bg-white/5 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-60 transition-all"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Sauvegarder
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 border border-gray-700 hover:text-gray-200 hover:border-gray-600 hover:bg-white/5 transition-all"
              >
                <Edit2 size={14} />
                Modifier
              </button>

              {post.status !== "published" && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-400 border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/20 disabled:opacity-60 transition-all"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Marquer comme publié
                </button>
              )}

              {confirmDelete ? (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg text-sm text-gray-400 border border-gray-700 hover:bg-white/5 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-red-400 border border-red-500/30 bg-red-500/8 hover:bg-red-500/20 transition-all"
                  >
                    Confirmer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/8 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar page ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { showToast } = useToast();
  const today = new Date();
  const [view, setView] = useState<ViewMode>("week");
  const [refDate, setRefDate] = useState(today);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/posts?status=draft,validated,scheduled,published")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setPosts(data); setLoading(false); });
  }, []);

  // ── Navigation ──
  const goPrev = () => setRefDate((d) => view === "week" ? subWeeks(d, 1) : subMonths(d, 1));
  const goNext = () => setRefDate((d) => view === "week" ? addWeeks(d, 1) : addMonths(d, 1));
  const goToday = () => setRefDate(today);

  // ── Post state helpers ──
  function updatePost(updated: GeneratedPost) {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    if (selectedPost?.id === updated.id) setSelectedPost(updated);
  }
  function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPost?.id === id) setSelectedPost(null);
  }

  // ── Optimistic patch + server sync ──
  function applyPatch(id: string, patch: Partial<GeneratedPost>) {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  // ── DnD handlers ──
  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (!over) return;
    const postId = String(active.id);
    const dropId = String(over.id);
    if (dropId === "unscheduled") {
      applyPatch(postId, { scheduled_date: null, status: "validated" });
    } else {
      applyPatch(postId, { scheduled_date: toUTC9(new Date(dropId)), status: "scheduled" });
      showToast("Post déplacé dans le calendrier");
    }
  }

  // ── Data helpers ──
  function postsForDay(date: Date) {
    return posts.filter((p) => p.scheduled_date && isSameDay(new Date(p.scheduled_date), date));
  }

  const unscheduled = posts.filter((p) => !p.scheduled_date && p.status !== "published");
  const activeDragPost = activeDragId ? posts.find((p) => p.id === activeDragId) : null;

  // ── Titles ──
  const days = weekDays(refDate);
  const weekTitle = `${format(days[0], "d")} – ${format(days[6], "d")} ${FR_MONTHS[days[6].getMonth()]} ${format(days[6], "yyyy")}`;
  const monthTitle = `${FR_MONTHS[refDate.getMonth()]} ${format(refDate, "yyyy")}`;
  const grid = monthGrid(refDate);

  return (
    <div className="flex flex-col h-screen">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
            <CalendarDays size={17} className="text-brand-400" />
          </div>
          <div>
            <h1 className="font-semibold text-white text-sm">Calendrier éditorial</h1>
            <p className="text-xs text-gray-500">{view === "week" ? weekTitle : monthTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nav buttons */}
          <div className="flex items-center border border-gray-700 rounded-lg overflow-hidden">
            <button onClick={goPrev} className="p-2 hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/8 border-x border-gray-700 transition-colors">
              Aujourd&apos;hui
            </button>
            <button onClick={goNext} className="p-2 hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDay(null); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === v ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <Link
            href="/create"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-all"
          >
            <Plus size={13} />
            Créer
          </Link>
        </div>
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={22} className="animate-spin text-brand-400" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-gray-800/60 border border-gray-700 flex items-center justify-center">
              <CalendarDays size={24} className="text-gray-600" />
            </div>
            <div>
              <p className="text-gray-300 font-medium text-sm mb-1.5">Aucun post à planifier</p>
              <p className="text-gray-600 text-xs leading-relaxed max-w-xs">
                Validez des posts dans Créer pour les voir apparaître ici
              </p>
            </div>
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-all"
            >
              <Plus size={14} />
              Créer des posts
            </Link>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {view === "week" ? (
              /* ── WEEK VIEW ── */
              <div className="flex h-full">
                <UnscheduledColumn posts={unscheduled} onPostClick={setSelectedPost} />
                {days.map((date) => (
                  <DayColumn
                    key={dateId(date)}
                    date={date}
                    posts={postsForDay(date)}
                    onPostClick={setSelectedPost}
                    onPublish={(id) => applyPatch(id, { status: "published" })}
                  />
                ))}
              </div>
            ) : (
              /* ── MONTH VIEW ── */
              <div className="flex h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
                    {FR_DAYS.map((d) => (
                      <div key={d} className="py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider text-center border-r border-gray-800 last:border-r-0">
                        {d}
                      </div>
                    ))}
                  </div>
                  {grid.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                      {week.map((date) => (
                        <DayCell
                          key={dateId(date)}
                          date={date}
                          posts={postsForDay(date)}
                          isCurrentMonth={isSameMonth(date, refDate)}
                          isSelected={!!selectedDay && isSameDay(date, selectedDay)}
                          onDayClick={() =>
                            setSelectedDay((prev) =>
                              prev && isSameDay(prev, date) ? null : date
                            )
                          }
                          onPostClick={setSelectedPost}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Day side panel */}
                {selectedDay && (
                  <div className="w-72 shrink-0 border-l border-gray-800 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
                      <p className="text-sm font-semibold text-white">
                        {FR_DAYS[(selectedDay.getDay() + 6) % 7]}{" "}
                        {format(selectedDay, "d")}{" "}
                        {FR_MONTHS[selectedDay.getMonth()]}
                      </p>
                      <button
                        onClick={() => setSelectedDay(null)}
                        className="p-1 rounded-md text-gray-600 hover:text-gray-300 hover:bg-white/10 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {postsForDay(selectedDay).length === 0 ? (
                        <p className="text-xs text-gray-600 text-center pt-8 leading-relaxed">
                          Aucun post<br />planifié ce jour
                        </p>
                      ) : (
                        postsForDay(selectedDay).map((p) => {
                          const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPost(p)}
                              className="w-full text-left p-3 glass rounded-lg hover:bg-white/8 transition-colors"
                            >
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                {p.format && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/8 text-gray-500">{p.format}</span>
                                )}
                                <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium border", cfg.badge)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed line-clamp-3">
                                {p.content.slice(0, 120)}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DnD ghost overlay */}
            <DragOverlay dropAnimation={null}>
              {activeDragPost && <DragPreview post={activeDragPost} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Detail modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onUpdate={updatePost}
          onDelete={removePost}
        />
      )}
    </div>
  );
}
