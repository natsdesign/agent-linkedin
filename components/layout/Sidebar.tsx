"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, PenSquare, CalendarDays, Settings, DollarSign, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CostDrawer } from "@/components/layout/CostDrawer";

const CONTENT_NAV = [
  { href: "/inspirations", label: "Inspirations", icon: Users },
  { href: "/create",       label: "Créer",         icon: PenSquare },
  { href: "/calendar",     label: "Calendrier",    icon: CalendarDays },
];

const ME_NAV = [
  { href: "/analytics",   label: "Mon compte",  icon: BarChart2 },
  { href: "/onboarding",  label: "Mon profil",  icon: Settings },
];

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-[450] transition-all duration-150",
        active
          ? "bg-[#0D2B22] text-[#10B981] border-l-2 border-[#10B981] pl-[10px]"
          : "text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F]"
      )}
    >
      <Icon size={15} className="shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [costOpen, setCostOpen] = useState(false);

  return (
    <>
      <aside
        className="flex flex-col shrink-0 h-screen"
        style={{
          width: "220px",
          background: "#0A0A0F",
          borderRight: "1px solid #1E1E26",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-4 py-5"
          style={{ borderBottom: "1px solid #1E1E26" }}
        >
          <span
            className="w-2 h-2 rounded-full animate-pulse-dot shrink-0"
            style={{ background: "#10B981" }}
          />
          <span className="text-[16px] font-bold text-white tracking-tight">
            Content Agent
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto">
          {/* Groupe CONTENU */}
          <p
            className="label-section px-3 pb-1.5"
            style={{ marginTop: "8px" }}
          >
            Contenu
          </p>
          <div className="space-y-0.5 mb-2">
            {CONTENT_NAV.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}
          </div>

          {/* Groupe MOI */}
          <p
            className="label-section px-3 pb-1.5"
            style={{ marginTop: "24px" }}
          >
            Moi
          </p>
          <div className="space-y-0.5">
            {ME_NAV.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}

            <button
              onClick={() => setCostOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] font-[450] text-[#8B8B9E] hover:text-[#F0F0F5] hover:bg-[#1A1A1F] transition-all duration-150"
            >
              <DollarSign size={15} className="shrink-0" />
              Coûts
            </button>
          </div>
        </nav>
      </aside>

      <CostDrawer open={costOpen} onClose={() => setCostOpen(false)} />
    </>
  );
}
