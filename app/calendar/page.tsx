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

const STATUS_CFG: Record<PostStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: "Brouillon", bg: "#1A1A1F",  color: "#8B8B9E" },
  validated: { label: "Validé",    bg: "#064E3B",  color: "#10B981" },
  scheduled: { label: "Planifié",  bg: "#451A03",  color: "#F59E0B" },
  published: { label: "Publié",    bg: "#0D2B22",  color: "#10B981" },
};

const FORMAT_DOT: Record<string, string> = {
  liste: "#60A5FA", storytelling: "#A78BFA",
  carrousel: "#F59E0B", court: "#10B981", texte: "#8B8B9E",
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
  const dotColor = FORMAT_DOT[post.format ?? "texte"] ?? "#8B8B9E";

  return (
    <div
      ref={setNodeRef}
      className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing select-none transition-all"
      style={{
        background: "#1A1A1F",
        border: `1px solid ${isDragging ? "#2A2A32" : "#2A2A32"}`,
        opacity: isDragging ? 0.3 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <p className="text-[11px] text-[#F0F0F5] leading-relaxed line-clamp-2">
        {post.content.slice(0, 80)}{post.content.length > 80 ? "…" : ""}
      </p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {post.format && (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px]"
            style={{ background: "#111115", color: "#8B8B9E" }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
            {post.format}
          </span>
        )}
        <span
          className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>
      {post.status === "scheduled" && onPublish && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onPublish(); }}
          className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] font-semibold transition-colors"
          style={{ background: "#064E3B", color: "#10B981", border: "1px solid #10B981" }}
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
    <div
      className="w-44 rounded-lg p-2.5 rotate-1"
      style={{ background: "#1A1A1F", border: "1px solid #10B981", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
    >
      <p className="text-[11px] text-[#F0F0F5] line-clamp-2">{post.content.slice(0, 80)}</p>
      {post.format && (
        <span
          className="mt-1.5 inline-block px-1.5 py-0.5 rounded-md text-[10px]"
          style={{ background: "#064E3B", color: "#10B981" }}
        >
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
    <div
      className="flex-1 min-w-0 flex flex-col h-full overflow-hidden"
      style={{ borderRight: "1px solid #2A2A32" }}
    >
      <div
        className="shrink-0 px-2 pt-3 pb-2.5 text-center"
        style={{
          borderBottom: "1px solid #2A2A32",
          background: today ? "#0D2B22" : "transparent",
          borderTop: today ? "2px solid #10B981" : "none",
        }}
      >
        <p className="text-[10px] font-semibold text-[#55555F] uppercase tracking-wider">{FR_DAYS[dow]}</p>
        <p className="text-xl font-bold leading-tight" style={{ color: today ? "#10B981" : "#F0F0F5" }}>
          {format(date, "d")}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-1.5 transition-colors min-h-0"
        style={{ background: isOver ? "#0D2B22" : "transparent" }}
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
    <div
      className="w-48 shrink-0 flex flex-col h-full overflow-hidden"
      style={{ borderRight: "1px solid #2A2A32", background: "#111115" }}
    >
      <div className="shrink-0 px-3 pt-3 pb-2.5" style={{ borderBottom: "1px solid #2A2A32" }}>
        <p className="text-xs font-semibold text-[#8B8B9E]">Non planifiés</p>
        <p className="text-[11px] text-[#55555F] mt-0.5">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto p-1.5 space-y-1.5 min-h-0 transition-colors"
        style={{ background: isOver ? "#0D2B22" : "transparent" }}
      >
        {posts.length === 0 ? (
          <p className="text-[11px] text-[#55555F] text-center pt-6 px-2 leading-relaxed">
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
      className="min-h-[88px] p-1.5 cursor-pointer transition-colors"
      style={{
        borderBottom: "1px solid #2A2A32",
        borderRight: "1px solid #2A2A32",
        background: isOver ? "#0D2B22" : isSelected ? "#0D2B22" : !isCurrentMonth ? "#111115" : "transparent",
        outline: isSelected ? "1px solid #10B981" : "none",
        outlineOffset: "-1px",
      }}
    >
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1"
        style={{
          background: today ? "#10B981" : "transparent",
          color: today ? "#0F0F10" : isCurrentMonth ? "#F0F0F5" : "#55555F",
        }}
      >
        {format(date, "d")}
      </span>
      <div className="space-y-0.5">
        {posts.slice(0, 3).map((p) => {
          const dotColor = FORMAT_DOT[p.format ?? "texte"] ?? "#8B8B9E";
          return (
            <div
              key={p.id}
              onClick={(e) => { e.stopPropagation(); onPostClick(p); }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer transition-colors"
              style={{ background: "#1A1A1F", color: "#8B8B9E" }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
              <span className="truncate">{p.content.slice(0, 20)}</span>
            </div>
          );
        })}
        {posts.length > 3 && (
          <p className="text-[10px] text-[#55555F] px-1">+{posts.length - 3} autres</p>
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
  const [editing,     setEditing]     = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [saving,      setSaving]      = useState(false);
  const [publishing,  setPublishing]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const cfg = STATUS_CFG[post.status] ?? STATUS_CFG.draft;

  async function handleCopy() {
    await navigator.clipboard.writeText(post.content);
    setCopied(true);
    showToast("Post copié !");
    setTimeout(() => setCopied(false), 2000);
  }

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl flex flex-col max-h-[85vh]"
        style={{ background: "#1A1A1F", border: "1px solid #2A2A32", borderRadius: "10px" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 gap-3"
          style={{ borderBottom: "1px solid #2A2A32" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {post.format && (
              <span
                className="px-2 py-0.5 rounded-md text-xs shrink-0"
                style={{ background: "#111115", color: "#8B8B9E" }}
              >
                {post.format}
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              {cfg.label}
            </span>
            {post.subject && (
              <span className="text-sm text-[#55555F] truncate">{post.subject}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-[#55555F] hover:text-[#F0F0F5] hover:bg-[#222228] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {post.hook && (
            <div
              className="p-3 rounded-lg"
              style={{ background: "#0D2B22", borderLeft: "3px solid #10B981" }}
            >
              <p className="label-section mb-1">Accroche</p>
              <p className="text-sm text-[#F0F0F5]">{post.hook}</p>
            </div>
          )}

          {editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              autoFocus
              className="w-full rounded-lg p-3.5 text-sm text-[#F0F0F5] leading-relaxed resize-none focus:outline-none transition-all"
              style={{
                background: "#111115",
                border: "1px solid #10B981",
              }}
            />
          ) : (
            <div
              className="p-3.5 rounded-lg"
              style={{ background: "#111115", border: "1px solid #2A2A32" }}
            >
              <p className="text-sm text-[#F0F0F5] leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>
          )}

          {post.cta && (
            <div
              className="p-3 rounded-lg"
              style={{ background: "#222228", border: "1px solid #2A2A32" }}
            >
              <p className="label-section mb-1">CTA</p>
              <p className="text-sm text-[#8B8B9E]">{post.cta}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid #2A2A32" }}>
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditing(false); setEditContent(post.content); }}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium text-[#8B8B9E] transition-all"
                style={{ border: "1px solid #2A2A32" }}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: "#10B981", color: "#0F0F10" }}
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Sauvegarder
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#8B8B9E] hover:text-[#F0F0F5] transition-all"
                style={{ border: "1px solid #2A2A32" }}
              >
                <Edit2 size={13} />
                Modifier
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#8B8B9E] hover:text-[#F0F0F5] transition-all"
                style={{ border: "1px solid #2A2A32" }}
              >
                <Copy size={13} />
                {copied ? "Copié !" : "Copier"}
              </button>

              {post.status !== "published" && (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: "#064E3B", color: "#10B981", border: "1px solid #10B981" }}
                >
                  {publishing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Marquer comme publié
                </button>
              )}

              {confirmDelete ? (
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg text-sm text-[#8B8B9E] transition-all"
                    style={{ border: "1px solid #2A2A32" }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: "#450A0A", color: "#EF4444", border: "1px solid #EF4444" }}
                  >
                    Confirmer
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="ml-auto p-2 rounded-lg text-[#55555F] hover:text-[#EF4444] transition-all"
                >
                  <Trash2 size={15} />
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
  const [view,         setView]         = useState<ViewMode>("week");
  const [refDate,      setRefDate]      = useState(today);
  const [posts,        setPosts]        = useState<GeneratedPost[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<GeneratedPost | null>(null);
  const [selectedDay,  setSelectedDay]  = useState<Date | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => {
    fetch("/api/posts?status=draft,validated,scheduled,published")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { setPosts(data); setLoading(false); });
  }, []);

  const goPrev  = () => setRefDate((d) => view === "week" ? subWeeks(d, 1) : subMonths(d, 1));
  const goNext  = () => setRefDate((d) => view === "week" ? addWeeks(d, 1) : addMonths(d, 1));
  const goToday = () => setRefDate(today);

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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
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

  const unscheduled    = posts.filter((p) => !p.scheduled_date && p.status !== "published");
  const activeDragPost = activeDragId ? posts.find((p) => p.id === activeDragId) : null;

  const days      = weekDays(refDate);
  const weekTitle = `${format(days[0], "d")} – ${format(days[6], "d")} ${FR_MONTHS[days[6].getMonth()]} ${format(days[6], "yyyy")}`;
  const monthTitle = `${FR_MONTHS[refDate.getMonth()]} ${format(refDate, "yyyy")}`;
  const grid      = monthGrid(refDate);

  return (
    <div className="flex flex-col h-screen" style={{ background: "#0F0F10" }}>
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-8 py-4 shrink-0"
        style={{ borderBottom: "1px solid #2A2A32", background: "#0A0A0F" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#0D2B22", border: "1px solid #064E3B" }}
          >
            <CalendarDays size={15} className="text-[#10B981]" />
          </div>
          <div>
            <h1 className="font-semibold text-[#F0F0F5] text-sm">Calendrier éditorial</h1>
            <p className="text-xs text-[#55555F]">{view === "week" ? weekTitle : monthTitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nav buttons */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{ border: "1px solid #2A2A32" }}
          >
            <button
              onClick={goPrev}
              className="p-2 text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-colors"
              style={{ borderLeft: "1px solid #2A2A32", borderRight: "1px solid #2A2A32" }}
            >
              Aujourd&apos;hui
            </button>
            <button
              onClick={goNext}
              className="p-2 text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg p-0.5" style={{ background: "#111115", border: "1px solid #2A2A32" }}>
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setSelectedDay(null); }}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  view === v
                    ? { background: "#1A1A1F", color: "#F0F0F5" }
                    : { color: "#55555F" }
                }
              >
                {v === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          <Link
            href="/create"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.98]"
            style={{ background: "#10B981", color: "#0F0F10" }}
          >
            <Plus size={12} />
            Créer
          </Link>
        </div>
      </div>

      {/* ── Calendar body ── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={22} className="animate-spin text-[#10B981]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div
              className="w-12 h-12 rounded-[10px] flex items-center justify-center"
              style={{ background: "#1A1A1F", border: "1px solid #2A2A32" }}
            >
              <CalendarDays size={20} className="text-[#55555F]" />
            </div>
            <div>
              <p className="text-[#F0F0F5] font-medium text-sm mb-1.5">Aucun post à planifier</p>
              <p className="text-[#55555F] text-xs leading-relaxed max-w-xs">
                Validez des posts dans Créer pour les voir apparaître ici
              </p>
            </div>
            <Link
              href="/create"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-[0.98]"
              style={{ background: "#10B981", color: "#0F0F10" }}
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
                  <div
                    className="grid grid-cols-7 sticky top-0 z-10"
                    style={{ borderBottom: "1px solid #2A2A32", background: "#0A0A0F" }}
                  >
                    {FR_DAYS.map((d) => (
                      <div
                        key={d}
                        className="py-2.5 text-xs font-semibold text-[#55555F] uppercase tracking-wider text-center"
                        style={{ borderRight: "1px solid #2A2A32" }}
                      >
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
                  <div
                    className="w-72 shrink-0 flex flex-col h-full overflow-hidden"
                    style={{ borderLeft: "1px solid #2A2A32", background: "#111115" }}
                  >
                    <div
                      className="flex items-center justify-between px-4 py-3 shrink-0"
                      style={{ borderBottom: "1px solid #2A2A32" }}
                    >
                      <p className="text-sm font-semibold text-[#F0F0F5]">
                        {FR_DAYS[(selectedDay.getDay() + 6) % 7]}{" "}
                        {format(selectedDay, "d")}{" "}
                        {FR_MONTHS[selectedDay.getMonth()]}
                      </p>
                      <button
                        onClick={() => setSelectedDay(null)}
                        className="p-1 rounded-md text-[#55555F] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                      {postsForDay(selectedDay).length === 0 ? (
                        <p className="text-xs text-[#55555F] text-center pt-8 leading-relaxed">
                          Aucun post<br />planifié ce jour
                        </p>
                      ) : (
                        postsForDay(selectedDay).map((p) => {
                          const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.draft;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPost(p)}
                              className="w-full text-left p-3 rounded-lg transition-all"
                              style={{ background: "#1A1A1F", border: "1px solid #2A2A32" }}
                            >
                              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                {p.format && (
                                  <span
                                    className="px-1.5 py-0.5 rounded-md text-[10px]"
                                    style={{ background: "#111115", color: "#8B8B9E" }}
                                  >
                                    {p.format}
                                  </span>
                                )}
                                <span
                                  className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                                  style={{ background: cfg.bg, color: cfg.color }}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-[#8B8B9E] leading-relaxed line-clamp-3">
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
