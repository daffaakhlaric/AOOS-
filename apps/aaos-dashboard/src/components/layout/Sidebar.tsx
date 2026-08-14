"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** A single sidebar/mobile-nav link. */
export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

const OVERVIEW: NavItem = { href: "/dashboard", label: "Overview", icon: "🎯" };
const DATA_IKLAN: NavItem = { href: "/meta-ads", label: "Data Iklan", icon: "📊" };
const AUDIT_BIAYA: NavItem = { href: "/meta-ads/audit", label: "Audit Biaya", icon: "💰" };
const ANALISA: NavItem = {
  href: "/meta-ads/analisa",
  label: "Analisa & Rekomendasi",
  icon: "🎯",
};
const STRATEGI: NavItem = { href: "/meta-ads/strategi", label: "Strategi & Approve", icon: "🧭" };
const SIMULASI: NavItem = {
  href: "/meta-ads/simulasi",
  label: "Simulasi Tamara × Kai",
  icon: "🎬",
};
const OBJECTIVE: NavItem = { href: "/objective", label: "Objective", icon: "🎯" };
const LEADS: NavItem = { href: "/leads", label: "Leads", icon: "🔥" };
const CREATIVE: NavItem = { href: "/creative", label: "Creative Review", icon: "🎨" };
const BRANCHES: NavItem = { href: "/branches", label: "Branch Settings", icon: "⚙️" };
const KNOWLEDGE: NavItem = { href: "/knowledge", label: "Knowledge Base", icon: "📚" };
const SIMULATOR: NavItem = { href: "/simulator", label: "Simulator (Jessy)", icon: "🎮" };

/**
 * Flat list of every nav item — the order `MobileNav.tsx` slices `[0, 5)` from for its bottom tab
 * bar. Deliberately NOT the same order as the desktop `Sidebar`'s 🤖 TAMARA / 📋 OPERASIONAL
 * grouping below (`NAV_GROUPS`): the mobile bar only ever shows 5 items, and this order keeps the
 * same 5 highest-traffic pages visible there (Overview, Data Iklan, Objective, Creative Review,
 * Leads — unchanged from before this restructure) rather than letting the 4 new Tamara sub-pages
 * crowd out Objective/Leads/Creative Review on mobile. Desktop `Sidebar` renders from `NAV_GROUPS`
 * instead, so this ordering choice only affects mobile.
 */
const NAV_ITEMS = [
  OVERVIEW,
  DATA_IKLAN,
  OBJECTIVE,
  CREATIVE,
  LEADS,
  AUDIT_BIAYA,
  ANALISA,
  STRATEGI,
  SIMULASI,
  BRANCHES,
  KNOWLEDGE,
  SIMULATOR,
] as const satisfies readonly NavItem[];

export interface NavGroup {
  readonly key: string;
  readonly label?: string;
  readonly items: readonly NavItem[];
}

/**
 * Grouped sidebar structure (spec "SIDEBAR MENU RESTRUCTURE": 🤖 TAMARA (META ADS) / 📋
 * OPERASIONAL). "Overview" (`/dashboard`) predates both groups and isn't mentioned by either —
 * kept as its own ungrouped top entry rather than dropped, since removing a working, linked-to
 * route isn't part of this restructure's scope.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  { key: "top", items: [OVERVIEW] },
  {
    key: "tamara",
    label: "🤖 TAMARA (META ADS)",
    items: [DATA_IKLAN, AUDIT_BIAYA, ANALISA, STRATEGI, SIMULASI],
  },
  {
    key: "operasional",
    label: "📋 OPERASIONAL",
    items: [OBJECTIVE, LEADS, CREATIVE, BRANCHES, KNOWLEDGE, SIMULATOR],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * Desktop navigation sidebar (spec "components/layout/Sidebar.tsx") — hidden below `md`, where
 * `MobileNav` takes over (spec "Mobile responsive"). Grouped into 🤖 TAMARA (META ADS) / 📋
 * OPERASIONAL sections (AAOS-TAMARA-PAGES redesign).
 *
 * UI-overhaul pass ("=== SIDEBAR ===" spec section): fixed 220px width, logo area with a live
 * indicator dot, collapsible section headers (chevron rotates, 200ms height transition — CSS
 * grid-template-rows trick via `.sidebar-group-collapse` in `globals.css`, since collapsing to
 * `height: 0` requires either JS-measured pixel heights or the CSS-grid `1fr`→`0fr` technique;
 * the latter needs no JS measurement and animates smoothly), and the spec's exact nav-item
 * active/hover states. Groups start EXPANDED by default so every nav item stays discoverable
 * (and in the DOM) without requiring a click — matching the pre-overhaul component's always-
 * visible behavior for callers/tests that don't interact with the collapse toggle.
 */
export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(key: string): void {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <nav
      aria-label="Navigasi utama"
      className="hidden w-[220px] shrink-0 flex-col gap-1 border-r border-hairline-sidebar bg-[#FAFAFA] p-4 md:flex"
    >
      <div className="mb-4 flex flex-col gap-1 px-2">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-bold text-ink">🚗 AAOS</p>
          <span
            aria-hidden="true"
            title="Live"
            className="h-1.5 w-1.5 rounded-full bg-brand-success"
          />
        </div>
        <p className="text-[11px] text-ink-muted">AI Automotive OS</p>
      </div>
      {NAV_GROUPS.map((group) => {
        const collapsed = collapsedGroups[group.key] ?? false;
        return (
          <div key={group.key} className="flex flex-col gap-1">
            {group.label !== undefined ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={!collapsed}
                className="mb-1 mt-3 flex items-center justify-between px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#A0A0A8] first:mt-0"
              >
                {group.label}
                <span
                  aria-hidden="true"
                  className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
                >
                  ▾
                </span>
              </button>
            ) : null}
            <div
              className="sidebar-group-collapse grid"
              style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
            >
              <div className="flex flex-col gap-1 overflow-hidden">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mx-[6px] my-[1px] flex h-[34px] items-center gap-2 rounded-[6px] py-0 pl-3 pr-2 text-[13.5px] font-medium ${
                        active
                          ? "border-l-2 border-brand-primary bg-[#E8F0FE] text-brand-primary"
                          : "border-l-2 border-transparent text-[#3A3A3C] hover:bg-[#EFEFEF]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span aria-hidden="true" className="text-base leading-none">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export { NAV_ITEMS };
