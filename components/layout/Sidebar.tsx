"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, PenSquare, CalendarDays, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/inspirations", label: "Inspirations", icon: Users },
  { href: "/create", label: "Créer", icon: PenSquare },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 border-r border-gray-800 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-600">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-white tracking-tight">Content Agent</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
                  : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
              )}
            >
              <Icon
                className={cn("w-4.5 h-4.5", active ? "text-brand-400" : "text-gray-500")}
                size={18}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800">
        <Link
          href="/onboarding"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            pathname.startsWith("/onboarding")
              ? "bg-brand-600/20 text-brand-400 border border-brand-500/30"
              : "text-gray-400 hover:text-gray-100 hover:bg-white/5"
          )}
        >
          <Settings
            size={18}
            className={pathname.startsWith("/onboarding") ? "text-brand-400" : "text-gray-500"}
          />
          Mon profil
        </Link>
      </div>
    </aside>
  );
}
