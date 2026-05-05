"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, PenSquare, CalendarDays, Zap, Settings, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { CostDrawer } from "@/components/layout/CostDrawer";

const navItems = [
  { href: "/inspirations", label: "Inspirations", icon: Users },
  { href: "/create",       label: "Créer",         icon: PenSquare },
  { href: "/calendar",     label: "Calendrier",    icon: CalendarDays },
];

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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
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
                <Icon
                  size={17}
                  className={cn("shrink-0", active ? "text-brand-600" : "text-zinc-400")}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-zinc-100 space-y-0.5">
          <Link
            href="/onboarding"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              pathname.startsWith("/onboarding")
                ? "bg-brand-50 text-brand-700"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
            )}
          >
            <Settings
              size={17}
              className={pathname.startsWith("/onboarding") ? "text-brand-600" : "text-zinc-400"}
            />
            Mon profil
          </Link>

          <button
            onClick={() => setCostOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all"
          >
            <DollarSign size={17} className="text-zinc-400 shrink-0" />
            Coûts
          </button>
        </div>
      </aside>

      <CostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
    </>
  );
}
