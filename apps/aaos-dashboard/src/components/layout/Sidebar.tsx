"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./Sidebar.module.css";

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
  label: "Simulasi Tamara × Kai × Jessy",
  icon: "🎬",
};
const OBJECTIVE: NavItem = { href: "/objective", label: "Objective", icon: "🎯" };
const LEADS: NavItem = { href: "/leads", label: "Leads", icon: "🔥" };
const CREATIVE: NavItem = { href: "/creative", label: "Creative Review", icon: "🎨" };
/**
 * AAOS-SCRAPER-ASSET-LIBRARY. Placed in the OPERASIONAL group after `CREATIVE` and before
 * `BRANCHES` (matching the spec's proposed ordering). Deliberately NOT added to the mobile
 * `NAV_ITEMS` list below — same precedent as `SIMULASI`/`SIMULATOR`, whose 5-slot bottom bar must
 * stay focused on the highest-traffic pages.
 */
const SCRAPER_MOBIX: NavItem = { href: "/assets/scraper", label: "Scraper Mobix", icon: "📸" };
const ASSET_LIBRARY: NavItem = { href: "/assets/library", label: "Asset Library", icon: "🗂" };
const BRANCHES: NavItem = { href: "/branches", label: "Branch Settings", icon: "⚙️" };
const KNOWLEDGE: NavItem = { href: "/knowledge", label: "Knowledge Base", icon: "📚" };
const SIMULATOR: NavItem = { href: "/simulator", label: "Simulator (Jessy)", icon: "🎮" };

/**
 * Flat list of every nav item — the order `MobileNav.tsx` slices `[0, 5)` from for its bottom tab
 * bar. Deliberately NOT the same order as the desktop `Sidebar`'s TAMARA / OPERASIONAL grouping
 * below (`NAV_GROUPS`): the mobile bar only ever shows 5 items, and this order keeps the
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
 * Grouped sidebar structure (spec "SIDEBAR MENU RESTRUCTURE": TAMARA (META ADS) / OPERASIONAL).
 * "Overview" (`/dashboard`) predates both groups and isn't mentioned by either — kept as its own
 * ungrouped top entry rather than dropped, since removing a working, linked-to route isn't part
 * of this restructure's scope.
 *
 * FINAL UI REBUILD (reference screenshot restyle): group labels dropped their leading 🤖/📋 emoji
 * to match the reference's plain uppercase section headers — purely a label-text change, the real
 * pages/routes grouped under each stayed exactly the same (the reference screenshot's own menu
 * items — Ad Set, Performa Iklan, Belanja, Tim & Akses, Laporan, Pengaturan — don't correspond to
 * real pages in this app, so only the visual style was carried over, not those item names).
 */
const NAV_GROUPS: readonly NavGroup[] = [
  { key: "top", items: [OVERVIEW] },
  {
    key: "tamara",
    label: "TAMARA (META ADS)",
    items: [DATA_IKLAN, AUDIT_BIAYA, ANALISA, STRATEGI, SIMULASI],
  },
  {
    key: "operasional",
    label: "OPERASIONAL",
    items: [
      OBJECTIVE,
      LEADS,
      CREATIVE,
      SCRAPER_MOBIX,
      ASSET_LIBRARY,
      BRANCHES,
      KNOWLEDGE,
      SIMULATOR,
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * TREMOR REBUILD spec STEP 3 ("Save state to localStorage: `sidebar_tamara`, `sidebar_ops`") — a
 * genuine, net-new addition (coordinator note #10): the collapse state above already existed but
 * was never persisted. One `localStorage` key per collapsible group, storing just `"true"`/
 * `"false"` (not a single combined JSON blob) so the two keys match the spec's exact literal names.
 */
const STORAGE_KEY_BY_GROUP: Readonly<Record<string, string>> = {
  tamara: "sidebar_tamara",
  operasional: "sidebar_ops",
};

/** Defensive read — never throws on a missing/corrupt/foreign value, same pattern `campaignsCache.ts` already establishes. Returns `undefined` (meaning "no stored preference, use the default") rather than `false` for anything that isn't the literal string `"true"`/`"false"`. */
function readStoredCollapsed(storageKey: string): boolean | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Defensive write — best-effort only; a full/disabled `localStorage` (private browsing, quota) must never break the sidebar toggle itself. */
function writeStoredCollapsed(storageKey: string, collapsed: boolean): void {
  try {
    localStorage.setItem(storageKey, String(collapsed));
  } catch {
    // Best-effort persistence only — the in-memory toggle above already applied.
  }
}

/**
 * Desktop navigation sidebar (spec "components/layout/Sidebar.tsx") — hidden below `md`, where
 * `MobileNav` takes over (spec "Mobile responsive"). Grouped into TAMARA (META ADS) / OPERASIONAL
 * sections (AAOS-TAMARA-PAGES redesign). "Lead & Spend per Cabang × Source" has no nav item of
 * its own — it's embedded at the top of Data Iklan (`DATA_IKLAN`'s own page), not a separate
 * route (user feedback: "itu data ada di halaman data iklan jadi di paling atas").
 *
 * TOTAL UI REBUILD spec "=== SIDEBAR ===": fixed 220px rail, logo area with a live indicator dot,
 * collapsible section headers (chevron rotates, 200ms height transition via CSS grid
 * `1fr`→`0fr`, same technique as before, now expressed in `Sidebar.module.css`), and the spec's
 * exact nav-item active/hover states (`::before` accent bar). Groups start EXPANDED by default so
 * every nav item stays discoverable (and in the DOM) without requiring a click — matching the
 * pre-rebuild component's always-visible behavior for callers/tests that don't interact with the
 * collapse toggle.
 *
 * The spec's "User section (bottom)" (avatar/name/role/logout) is intentionally NOT rendered
 * here: this component receives no user/session data (that lives in `TopBar`'s `userEmail`/
 * `onSignOut` props, wired per-page from server-side session lookups) — fabricating a user block
 * with no real backing data would violate the "never fabricate" precedent already established
 * elsewhere in this codebase (e.g. `DateRangeSelector.tsx`'s docstring). Sign-out remains
 * reachable via `TopBar`.
 */
export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Read persisted collapse state after mount only — `localStorage` doesn't exist during this
  // "use client" component's SSR pass (same reasoning as `MetaAdsClient.tsx`'s initial-load
  // effect); reading it inside a `useState` initializer would throw / cause a hydration mismatch.
  useEffect(() => {
    const restored: Record<string, boolean> = {};
    for (const [groupKey, storageKey] of Object.entries(STORAGE_KEY_BY_GROUP)) {
      const stored = readStoredCollapsed(storageKey);
      if (stored !== undefined) {
        restored[groupKey] = stored;
      }
    }
    if (Object.keys(restored).length > 0) {
      setCollapsedGroups((prev) => ({ ...prev, ...restored }));
    }
  }, []);

  function toggleGroup(key: string): void {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const storageKey = STORAGE_KEY_BY_GROUP[key];
      if (storageKey !== undefined) {
        writeStoredCollapsed(storageKey, next[key] ?? false);
      }
      return next;
    });
  }

  return (
    <nav aria-label="Navigasi utama" className={styles.sidebar}>
      {/* Logo mark restyled to the reference's plain black-square + wordmark (dropped the 🚗
          emoji/live-dot/"AI Automotive OS" subtext combo — the live dot was purely decorative,
          never backed by a real connectivity check, so trimming it isn't a functional loss). */}
      <div className={styles.logo}>
        <div className={styles.logoRow}>
          <span aria-hidden="true" className={styles.logoMark}>
            A
          </span>
          <p className={styles.logoText}>AAOS</p>
        </div>
      </div>
      <div className={styles.nav}>
        {NAV_GROUPS.map((group) => {
          const collapsed = collapsedGroups[group.key] ?? false;
          return (
            <div key={group.key} className={styles.group}>
              {group.label !== undefined ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={!collapsed}
                  className={styles.sectionLabel}
                >
                  {group.label}
                  <span
                    aria-hidden="true"
                    className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ""}`}
                  >
                    ▾
                  </span>
                </button>
              ) : null}
              <div className={`${styles.collapse} ${collapsed ? styles.collapsed : ""}`}>
                <div className={styles.collapseInner}>
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span aria-hidden="true" className={styles.navIcon}>
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
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
