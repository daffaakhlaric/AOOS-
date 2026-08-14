"use client";

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
  { items: [OVERVIEW] },
  { label: "🤖 TAMARA (META ADS)", items: [DATA_IKLAN, AUDIT_BIAYA, ANALISA, STRATEGI, SIMULASI] },
  { label: "📋 OPERASIONAL", items: [OBJECTIVE, LEADS, CREATIVE, BRANCHES, KNOWLEDGE, SIMULATOR] },
];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Desktop navigation sidebar (spec "components/layout/Sidebar.tsx") — hidden below `md`, where `MobileNav` takes over (spec "Mobile responsive"). Grouped into 🤖 TAMARA (META ADS) / 📋 OPERASIONAL sections (AAOS-TAMARA-PAGES redesign). */
export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi utama"
      className="hidden w-56 shrink-0 flex-col gap-1 border-r border-hairline bg-surface-card p-4 md:flex"
    >
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        AAOS Dashboard
      </p>
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label ?? `group-${index}`} className="flex flex-col gap-1">
          {group.label !== undefined ? (
            <p className="mb-1 mt-3 px-2 text-xs font-semibold uppercase tracking-wide text-ink-muted first:mt-0">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-primary/10 text-brand-primary"
                    : "text-ink hover:bg-surface-page"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export { NAV_ITEMS };
