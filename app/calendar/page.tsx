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
  Copy,
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
  draft:     { label: "Brouillon", dot: "bg-zinc-400",    badge: "text-zinc-600 bg-zinc-100 border-zinc-200" },
  validated: { label: "Validé",    dot: "bg-brand-500",   badge: "text-brand-700 bg-brand-100 border-brand-200" },
  scheduled: { label: "Planifié",  dot: "bg-amber-500",   badge: "text-amber-700 bg-amber-100 border-amber-200" },
  published: { label: "Publié",    dot: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-100 border-emerald-200" },
};

const FORMAT_DOT: Record<string, string> = {
  liste: "bg-blue-400", storytelling: "bg-violet-400",
  carrousel: "bg-amber-400", court: "bg-brand-400", texte: "bg-zinc-400",
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
        "rounded-lg border bg-white p-2.5 cursor-grab active:cursor-grabbing select-none transition-all shadow-sm",
        isDragging ? "opacity-30" : "border-zinc-200 hover:border-zinc-300 hover:shadow-md"
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <p className="text-[11px] text-zinc-700 leading-relaxed line-clamp-2">
        {post.content.slice(0, 80)}{post.content.length > 80 ? "…" : ""}
      </p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {post.format && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-500">
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
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          <Check size={10} strokeWidth={3} />
          Marquer publié
        </button>
      )}
    </div>
  );
}

function DragPreview({ post }: { post: GeneratedPost }) {
  return (
    <div className="w-44 rounded-lg border border-brand-400 bg-white p-2.5 shadow-xl rotate-1">
      <p className="text-[11px] text-zinc-700 line-clamp-2">{post.content.slice(0, 80)}</p>
      {post.format && (
        <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] bg-brand-100 text-brand-700">
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
  const dow   = (date.getDay() + 6) % 7;

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-zinc-200 last:border-r-0 h-full overflow-hidden">
      <div className={cn("shrink-0 px-2 pt-3 pb-2.5 border-b border-zinc-200 text-center", today && "bg-brand-50")}>
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{FR_DAYS[dow]}</p>
        <p className={cn("text-xl font-bold leading-tight", today ? "text-brand-600" : "text-zinc-700")}>
          {format(date, "d")}
        </p>
        {today && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mx-auto mt-1" />}
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-1.5 space-y-1.5 transition-colors min-h-0", isOver && "bg-brand-50")}
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
    <div className="w-48 shrink-0 flex flex-col border-r border-zinc-200 h-full overflow-hidden bg-zinc-50">
      <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-zinc-200">
        <p className="text-xs font-semibold text-zinc-500">Non planifiés</p>
        <p className="text-[11px] text-zinc-400 mt-0.5">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0 transition-colors", isOver && "bg-brand-50")}
      >
        {posts.length === 0 ? (
          <p className="text-[11px] text-zinc-400 text-center pt-6 px-2 leading-relaxed">
            Tous vos posts<br />sont planifiés
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
        "min-h-[88px] p-1.5 border-b border-r border-zinc-200 cursor-pointer transition-colors",
        !isCurrentMonth && "bg-zinc-50",
        isOver && "bg-brand-50",
        isSelected && "ring-1 ring-inset ring-brand-400 bg-brand-50",
        "hover:bg-zinc-50"
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1",
          today ? "bg-brand-500 text-white" : isCurrentMonth ? "text-zinc-700" : "text-zinc-300"
        )}
      >
        {format(date, "d")}
      </span>
      <div className="space-y-0.5">
        {posts.slice(0, 3).map((p) => (
          <div
            key={p.id}
            onClick={(e) => { e.stopPropagation(); onPostClick(p); }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-600 bg-zinc-100 hover:bg-zinc-200 truncate transition-colors cursor-pointer"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", FORMAT_DOT[p.format ?? "texte"] ?? "bg-zinc-400")} />
            <span className="truncate">{p.content.slice(0, 20)}</span>
          </div>
        ))}
        {posts.length > 3 && (
          <p className="text-[10px] text-zinc-400 px-1">+{posts.length - 3} autres</p>
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
  const { showToast } = useToast();
  const [editing,       setEditing]       = useState(false);
  const [editContent,   setEditContent]   = useState(post.content);
  const [saving,        setSaving]        = useState(false);
  const [publishing,    setPublishing]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied,        setCopied]        = useState(false);
  const cfg = STATUS_CFG[post.status] ?? STATUS_CFG.draft;

  async function handleCopy() {
    await navigator.clipboard.writeText(post.content);
    setCopied(true);
    showToast("Post copié !");
    setTimeout(() => setCopied(false), 2000);
  }

  async function patch(body: Partial<GeneratedPost>) {
    const res = await fetch(`/api/posts/${post.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0 gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {post.format && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-500 shrink-0">{post.format}</span>
            )}
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border shrink-0", cfg.badge)}>
              {cfg.label}
            </span>
            {post.subject && (
              <span className="text-sm text-zinc-400 truncate">{post.subject}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {post.hook && (
            <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-brand-600 font-semibold mb-1">Accroche</p>
              <p className="text-sm text-zinc-700">{post.hook}</p>
            </div>
          )}

          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              autoFocus
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-sm text-zinc-900 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
            />
          ) : (
            <div className="p-3.5 bg-zinc-50 border border-zinc-100 rounded-xl">
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          )}

          {post.cta && (
            <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1">CTA</p>
              <p className="text-sm text-zinc-600">{post.cta}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-zinc-100 shrink-0">
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setEditContent(post.content); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-60 transition-all"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Sauvegarder
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 border border-zinc-200 hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
              >
                <Edit2 size={14} />
                Modifier
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 border border-zinc-200 hover:text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 transition-all"
              >
                <Copy size={14} />
                {copied ? "Copié !" : "Copier"}
              </button>

              {post.status !== "published" && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 transition-all"
                >
                  {publishing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Marquer comme publié
                </button>
              )}

              {confirmDelete ? (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg text-sm text-zinc-500 border border-zinc-200 hover:bg-zinc-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 transition-all"
                  >
                    Confirmer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto p-2 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
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
  const [view,          setView]          = useState<ViewMode>("week");
  const [refDate,       setRefDate]       = useState(today);
  const [posts,         setPosts]         = useState<GeneratedPost[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeDragId,  setActiveDragId]  = useState<string | null>(null);
  const [selectedPost,  setSelectedPost]  = useState<GeneratedPost | null>(null);
  const [selectedDay,   setSelectedDay]   = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/posts?status=draft,validated,scheduled,published")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setPosts(data); setLoading(false); });
  }, []);

  const goPrev   = () => setRefDate((d) => view === "week" ? subWeeks(d, 1) : subMonths(d, 1));
  const goNext   = () => setRefDate((d) => view === "week" ? addWeeks(d, 1) : addMonths(d, 1));
  const goToday  = () => setRefDate(today);

  function updatePost(updated: GeneratedPost) {
    setPosts((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    if (selectedPost?.id === updated.id) setSelectedPost(updated);
  }
  function removePost(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPost?.id === id) setSelectedPost(null);
  }

  function applyPatch(id: string, patch: Partial<GeneratedPost>) {
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    fetch(`/api/posts/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(patch),
    });
  }

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

  function postsForDay(date: Date) {
    return posts.filter((p) => p.scheduled_date && isSameDay(new Date(p.scheduled_date), date));
  }

  const unscheduled   = posts.filter((p) => !p.scheduled_date && p.status !== "published");
  const activeDragPost = activeDragId ? posts.find((p) => p.id === activeDragId) : null;

  const days      = weekDays(refDate);
  const weekTitle = `${format(days[0], "d")} – ${format(days[6], "d")} ${FR_MONTHS[days[6].getMonth()]} ${format(days[6], "yyyy")}`;
  const monthTitle = `${FR_MONTHS[refDate.getMonth()]} ${format(refDate, "yyyy")}`;
  const grid      = monthGrid(refDate);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center">
            <CalendarDays size={17} className="text-brand-600" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-900 text-sm">Calendrier éditorial</h1>
            <p className="text-xs text-zinc-400">{view === "week" ? weekTitle : monthTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nav buttons */}
          <div className="flex items-center border border-zinc-200 rounded-lg overflow-hidden">
            <button onClick={goPrev} className="p-2 hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 transition-colors">
              <ChevronLeft size={15} />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 border-x border-zinc-200 transition-colors">
              Aujourd&apos;hui
            </button>
            <button onClick={goNext} className="p-2 hover:bg-zinc-50 text-zinc-500 hover:text-zinc-900 transition-colors">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex bg-zinc-100 rounded-lg p-0.5">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDay(null); }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                {v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <Link
            href="/create"
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
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
            <Loader2 size={22} className="animate-spin text-brand-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center">
              <CalendarDays size={24} className="text-zinc-400" />
            </div>
            <div>
              <p className="text-zinc-700 font-medium text-sm mb-1.5">Aucun post à planifier</p>
              <p className="text-zinc-400 text-xs leading-relaxed max-w-xs">
                Validez des posts dans Créer pour les voir apparaître ici
              </p>
            </div>
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
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
                  <div className="grid grid-cols-7 border-b border-zinc-200 sticky top-0 bg-white z-10">
                    {FR_DAYS.map((d) => (
                      <div key={d} className="py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-center border-r border-zinc-200 last:border-r-0">
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
                  <div className="w-72 shrink-0 border-l border-zinc-200 flex flex-col h-full overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 shrink-0">
                      <p className="text-sm font-semibold text-zinc-900">
                        {FR_DAYS[(selectedDay.getDay() + 6) % 7]}{" "}
                        {format(selectedDay, "d")}{" "}
                        {FR_MONTHS[selectedDay.getMonth()]}
                      </p>
                      <button
                        onClick={() => setSelectedDay(null)}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {postsForDay(selectedDay).length === 0 ? (
                        <p className="text-xs text-zinc-400 text-center pt-8 leading-relaxed">
                          Aucun post<br />planifié ce jour
                        </p>
                      ) : (
                        postsForDay(selectedDay).map((p) => {
                          const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPost(p)}
                              className="w-full text-left p-3 bg-white border border-zinc-200 rounded-lg hover:border-zinc-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                {p.format && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-zinc-100 text-zinc-500">{p.format}</span>
                                )}
                                <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium border", cfg.badge)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-3">
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
