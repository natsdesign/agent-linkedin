"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users, PenSquare, CalendarDays, Zap, Settings,
  DollarSign, BarChart2, ChevronDown, Plus, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CostDrawer } from "@/components/layout/CostDrawer";

const CONTENT_NAV = [
  { href: "/inspirations", label: "Inspirations", icon: Users },
  { href: "/create",       label: "Créer",         icon: PenSquare },
  { href: "/calendar",     label: "Calendrier",    icon: CalendarDays },
];

const ME_NAV = [
  { href: "/analytics",  label: "Mon compte", icon: BarChart2 },
  { href: "/onboarding", label: "Mon profil",  icon: Settings },
];

type Account = {
  id: string;
  name: string;
  type: "personal" | "client";
  avatar_url?: string | null;
};

function AccountAvatar({ account, size = 22 }: { account: Account; size?: number }) {
  const initials = account.name.slice(0, 2).toUpperCase();
  if (account.avatar_url) {
    return (
      <img
        src={account.avatar_url}
        alt={account.name}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <span
      className="rounded-full bg-brand-500 flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

function CreateAccountModal({ onClose, onCreate }: { onClose: () => void; onCreate: (a: Account) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"personal" | "client">("client");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    if (res.ok) {
      const account = await res.json();
      onCreate(account);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-zinc-900 mb-4">Nouveau compte</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            autoFocus
            type="text"
            placeholder="Nom du compte"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-brand-400"
          />
          <div className="flex gap-2">
            {(["personal", "client"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  type === t
                    ? "border-brand-400 bg-brand-50 text-brand-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                )}
              >
                {t === "personal" ? "Personnel" : "Client"}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2 text-sm font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-all"
          >
            {loading ? "Création..." : "Créer"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
    fetch("/api/accounts/active").then((r) => r.json()).then((a) => a && setActiveId(a.id));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];

  async function switchAccount(id: string) {
    await fetch("/api/accounts/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: id }),
    });
    setActiveId(id);
    setOpen(false);
    window.location.reload();
  }

  function handleCreated(account: Account) {
    setAccounts((prev) => [...prev, account]);
    setShowCreate(false);
    switchAccount(account.id);
  }

  if (!active) return null;

  console.log('AccountSwitcher rendered');

  return (
    <>
      <div className="relative px-3 py-2 border-b border-zinc-100" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all duration-150",
            open ? "bg-zinc-100" : "hover:bg-zinc-50"
          )}
          style={{ height: 36 }}
        >
          <AccountAvatar account={active} size={22} />
          <span className="flex-1 text-left font-medium text-zinc-800 truncate text-[13px]">
            {active.name}
          </span>
          <ChevronDown
            size={14}
            className={cn("text-zinc-400 shrink-0 transition-transform duration-150", open && "rotate-180")}
          />
        </button>

        {open && (
          <div className="absolute left-3 right-3 top-full mt-1 z-40 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
            <div className="py-1">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => switchAccount(account.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-zinc-50 transition-all"
                >
                  <AccountAvatar account={account} size={24} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-zinc-800 text-[13px] truncate">{account.name}</p>
                    <p className="text-[11px] text-zinc-400">
                      {account.type === "personal" ? "Personnel" : "Client"}
                    </p>
                  </div>
                  {account.id === activeId && (
                    <Check size={14} className="text-brand-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-zinc-100">
              <button
                onClick={() => { setOpen(false); setShowCreate(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-all"
              >
                <span className="w-6 h-6 rounded-full border border-dashed border-zinc-300 flex items-center justify-center shrink-0">
                  <Plus size={12} />
                </span>
                <span className="text-[13px]">Nouveau compte</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAccountModal onClose={() => setShowCreate(false)} onCreate={handleCreated} />
      )}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [costOpen, setCostOpen] = useState(false);

  return (
    <>
      <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-zinc-200 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-zinc-100">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-500 shadow-sm">
            <Zap className="w-4 h-4 text-white" fill="currentColor" />
          </div>
          <span className="font-semibold text-zinc-900 tracking-tight">Content Agent</span>
        </div>

        {/* Account Switcher */}
        <AccountSwitcher />

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Groupe CONTENU */}
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
            Contenu
          </p>
          <div className="space-y-0.5 mb-2">
            {CONTENT_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <Icon size={17} className={cn("shrink-0", active ? "text-brand-600" : "text-zinc-400")} />
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Groupe MOI */}
          <p className="px-3 pb-1.5 mt-6 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
            Moi
          </p>
          <div className="space-y-0.5">
            {ME_NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                  )}
                >
                  <Icon size={17} className={cn("shrink-0", active ? "text-brand-600" : "text-zinc-400")} />
                  {label}
                </Link>
              );
            })}

            <button
              onClick={() => setCostOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
            >
              <DollarSign size={17} className="text-zinc-400 shrink-0" />
              Coûts
            </button>
          </div>
        </nav>
      </aside>

      <CostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
    </>
  );
}
