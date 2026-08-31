"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Vertical } from "@/types/tenant.types";

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
/** AAOS Analytics Platform Phase 3 — "Audience × Creative Heatmap" (`docs/PROMPT-AAOS-ANALYTICS-PLATFORM.md`), placed right after Analisa & Rekomendasi as another Samantha analytics view. */
const HEATMAP: NavItem = {
  href: "/meta-ads/analytics/heatmap",
  label: "Heatmap Audiens × Kreatif",
  icon: "🗺️",
};
/** AAOS-ABTESTING-LOOKALIKE Part 1 — Samantha's auto A/B test creative page, per the spec's own menu mockup ("🔬 A/B Testing", placed right before Simulasi). */
const ABTESTING: NavItem = { href: "/meta-ads/abtesting", label: "A/B Testing", icon: "🔬" };
/** AAOS-ABTESTING-LOOKALIKE Part 2 — hot-leads-based Lookalike Audience page, per the spec's own menu mockup ("👥 Lookalike Audience", placed right after A/B Testing, before Simulasi). */
const LOOKALIKE: NavItem = {
  href: "/meta-ads/lookalike",
  label: "Lookalike Audience",
  icon: "👥",
};
const SIMULASI: NavItem = {
  href: "/meta-ads/simulasi",
  label: "Simulasi Samantha × Kai × Clara",
  icon: "🎬",
};
const OBJECTIVE: NavItem = { href: "/objective", label: "Objective", icon: "🎯" };
/**
 * MENU RESTRUCTURE FINAL: `/leads` (the old flat leads list + `/leads/[leadId]` chat room) is
 * fully retired — replaced by the CLARA group's `CLARA_INBOX`/`CLARA_CONTACTS` below (coordinator
 * note #2's "rebuild fully as `/clara/inbox`, not keep the split-panel `/leads/[leadId]`").
 * `middleware.ts` redirects `/leads` → `/clara/inbox` for any stale bookmark/link.
 */
const CREATIVE: NavItem = { href: "/creative", label: "Creative Review", icon: "🎨" };
const SCRAPER_MOBIX: NavItem = { href: "/assets/scraper", label: "Scraper Mobix", icon: "📸" };
/** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 Part 3 — PROPERTY vertical's real replacement for `SCRAPER_MOBIX` (no scraper exists for that vertical; listings are entered manually). */
const LISTING_MANAGER: NavItem = { href: "/listings", label: "Listing Manager", icon: "🏠" };
const ASSET_LIBRARY: NavItem = { href: "/assets/library", label: "Asset Library", icon: "🗂" };
const BRANCHES: NavItem = { href: "/branches", label: "Branch Settings", icon: "⚙️" };
/** MENU RESTRUCTURE FINAL section 5: `/go-live` is a real, always-empty-for-now page — see `app/(app)/go-live/page.tsx`'s own docstring. */
const GO_LIVE: NavItem = { href: "/go-live", label: "Go Live Monitor", icon: "🚀" };
/** AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Part 2/4 — Meta token + WABA CRUD, added to OPERASIONAL per the coordinator note's Phase 1 scope. */
const SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: "⚙️" };
/** AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B — PROPERTY-only real agent activity log + realtime UI, per the design doc's own Phase B point 4 (mirrors `LISTING_MANAGER`'s PROPERTY-only conditional add to OPERASIONAL, not an unconditional item every vertical gets). */
const ACTIVITY_LOG: NavItem = { href: "/property/activity", label: "Activity Log", icon: "🪵" };

/** CLARA (SALES AI) group — MENU RESTRUCTURE FINAL. `/knowledge`/`/simulator` moved here from OPERASIONAL. */
const CLARA_ANALYTICS: NavItem = { href: "/clara/analytics", label: "Analytics", icon: "📊" };
const CLARA_INBOX: NavItem = { href: "/clara/inbox", label: "Inbox", icon: "💬" };
const CLARA_CONTACTS: NavItem = { href: "/clara/contacts", label: "Contacts", icon: "👥" };
const KNOWLEDGE: NavItem = { href: "/clara/knowledge", label: "Knowledge Base", icon: "📚" };
const SIMULATOR: NavItem = { href: "/clara/simulator", label: "Simulator", icon: "🎮" };
/** AAOS-LEAD-RECYCLING-BROADCAST — Clara's COLD/WARM lead re-engagement broadcast page. */
const RECYCLING: NavItem = { href: "/clara/recycling", label: "Lead Recycling", icon: "♻️" };

/** SOSIAL MEDIA group — AAOS-SOSMED-AUTOMATION Phase 5, per the spec's own menu mockup ("📱 SOSIAL MEDIA ← BARU (section terpisah)", placed between CLARA and KAI). */
const SOSMED_DASHBOARD: NavItem = { href: "/sosmed", label: "Dashboard Sosmed", icon: "📊" };
const SOSMED_CALENDAR: NavItem = {
  href: "/sosmed/calendar",
  label: "Content Calendar",
  icon: "📅",
};
const SOSMED_STUDIO: NavItem = { href: "/sosmed/studio", label: "Content Studio", icon: "✍️" };
const SOSMED_POSTS: NavItem = { href: "/sosmed/posts", label: "Post Manager", icon: "📤" };
const SOSMED_ANALYTICS: NavItem = {
  href: "/sosmed/analytics",
  label: "Analytics Sosmed",
  icon: "📈",
};
const SOSMED_ACCOUNTS: NavItem = { href: "/sosmed/accounts", label: "Akun Terhubung", icon: "⚙️" };

/**
 * Flat list of every nav item — the order `MobileNav.tsx` slices `[0, 5)` from for its bottom tab
 * bar. Deliberately NOT the same order as the desktop `Sidebar`'s group order below
 * (`NAV_GROUPS`): the mobile bar only ever shows 5 items. `CLARA_INBOX` replaces the retired
 * `LEADS` item in this list (same highest-traffic-page precedent as before this restructure —
 * Overview, Data Iklan, Objective, Creative Review, and now the Clara Inbox that replaced the
 * plain leads list) rather than letting the new Samantha/Clara sub-pages crowd this 5-slot bar.
 * Desktop `Sidebar` renders from `NAV_GROUPS` instead, so this ordering choice only affects
 * mobile.
 */
const NAV_ITEMS = [
  OVERVIEW,
  DATA_IKLAN,
  OBJECTIVE,
  CREATIVE,
  CLARA_INBOX,
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
 * Grouped sidebar structure — MENU RESTRUCTURE FINAL (`docs/PROMPT-AAOS-MENU-RESTRUCTURE-
 * FINAL.md`): "Overview" standalone at the top (NO section header, coordinator note #1 — real
 * route stays `/dashboard`, only this sidebar item's label/position changed), followed by 4
 * collapsible sections: SAMANTHA (META ADS) / CLARA (SALES AI) / KAI (CREATIVE) / OPERASIONAL.
 * CLARA is new — 5 pages (`/clara/analytics`, `/clara/inbox`, `/clara/contacts`,
 * `/clara/knowledge` moved from `/knowledge`, `/clara/simulator` moved from `/simulator`). KAI is
 * new — splits `CREATIVE`/`SCRAPER_MOBIX`/`ASSET_LIBRARY` out of the old flat OPERASIONAL group,
 * which they were only ever loosely grouped under before. OPERASIONAL keeps `OBJECTIVE`/
 * `BRANCHES` and gains `GO_LIVE` (coordinator note #5 — real page, honestly always-empty for now).
 */
/**
 * `NAV_GROUPS` moved from a constant to a function of `vertical` — AAOS-MULTI-TENANT-SUPERADMIN-
 * PROPERTY Phase 2 Part 3: for a PROPERTY tenant, the KAI section's label changes ("KAI
 * (CREATIVE)" -> "KAI (CREATIVE) — Properti") and `SCRAPER_MOBIX` (`/assets/scraper`, which reads
 * from the automotive-only scraper) is replaced by `LISTING_MANAGER` (`/listings`, spec Part 3's
 * "🏘️ KAI ... 🏠 Listing Manager /listings ← BARU (replace Scraper)"). Every other group is
 * identical across verticals ("SAMANTHA"/"CLARA" sections are spec-confirmed "sama seperti
 * Automotive"). `vertical` defaults to `undefined` (unresolved yet, see `Sidebar`'s fetch effect
 * below) — AUTOMOTIVE's real, already-shipped nav is shown until the real vertical is known, never
 * a flash of the PROPERTY nav for the common (AUTOMOTIVE) case.
 */
function buildNavGroups(vertical: Vertical | undefined): readonly NavGroup[] {
  const isProperty = vertical === "PROPERTY";
  return [
    { key: "top", items: [OVERVIEW] },
    {
      key: "samantha",
      label: "SAMANTHA (META ADS)",
      items: [DATA_IKLAN, AUDIT_BIAYA, ANALISA, HEATMAP, STRATEGI, ABTESTING, LOOKALIKE, SIMULASI],
    },
    {
      key: "clara",
      label: "CLARA (SALES AI)",
      items: [CLARA_ANALYTICS, CLARA_INBOX, CLARA_CONTACTS, KNOWLEDGE, SIMULATOR, RECYCLING],
    },
    {
      key: "sosmed",
      label: "SOSIAL MEDIA",
      items: [
        SOSMED_DASHBOARD,
        SOSMED_CALENDAR,
        SOSMED_STUDIO,
        SOSMED_POSTS,
        SOSMED_ANALYTICS,
        SOSMED_ACCOUNTS,
      ],
    },
    {
      key: "kai",
      label: isProperty ? "KAI (CREATIVE) — PROPERTI" : "KAI (CREATIVE)",
      items: isProperty
        ? [CREATIVE, LISTING_MANAGER, ASSET_LIBRARY]
        : [CREATIVE, SCRAPER_MOBIX, ASSET_LIBRARY],
    },
    {
      key: "operasional",
      label: "OPERASIONAL",
      items: isProperty
        ? [OBJECTIVE, BRANCHES, GO_LIVE, ACTIVITY_LOG, SETTINGS]
        : [OBJECTIVE, BRANCHES, GO_LIVE, SETTINGS],
    },
  ];
}

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * TREMOR REBUILD spec STEP 3 ("Save state to localStorage: `sidebar_samantha`, `sidebar_ops`") — a
 * genuine, net-new addition (coordinator note #10): the collapse state above already existed but
 * was never persisted. One `localStorage` key per collapsible group, storing just `"true"`/
 * `"false"` (not a single combined JSON blob) so the two keys match the spec's exact literal names.
 */
const STORAGE_KEY_BY_GROUP: Readonly<Record<string, string>> = {
  samantha: "sidebar_samantha",
  clara: "sidebar_clara",
  sosmed: "sidebar_sosmed",
  kai: "sidebar_kai",
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
 * `MobileNav` takes over (spec "Mobile responsive"). Grouped into SAMANTHA (META ADS) / CLARA
 * (SALES AI) / KAI (CREATIVE) / OPERASIONAL sections (MENU RESTRUCTURE FINAL, superseding the
 * earlier AAOS-SAMANTHA-PAGES 2-group layout). "Lead & Spend per Cabang × Source" has no nav item of
 * its own — it's embedded at the top of Data Iklan (`DATA_IKLAN`'s own page), not a separate
 * route (user feedback: "itu data ada di halaman data iklan jadi di paling atas").
 *
 * The `"top"` group (`OVERVIEW` alone) intentionally renders no `group.label` button — the spec's
 * "Overview standalone, paling atas, NO section header" — and is followed by a thin divider
 * (`styles.divider`) separating it visually from the 4 real collapsible sections below.
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
  const [vertical, setVertical] = useState<Vertical | undefined>(undefined);

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

  // AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 2 — resolves the real session's vertical via the
  // already-real `/api/settings` route (`lib/route-session.ts` -> `getSession().tenantId` ->
  // `apps/aaos-api`'s `GET /api/v1/settings`), the SAME endpoint the Settings page already calls —
  // no second "get my vertical" endpoint invented for this one sidebar label swap. `Sidebar` has no
  // server-side session prop today (see this component's class doc), so a client-side fetch is the
  // real mechanism here, not a fabricated one; a failed/pending fetch just keeps the AUTOMOTIVE nav.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) =>
        res.ok ? (res.json() as Promise<{ tenant?: { vertical?: Vertical } }>) : null,
      )
      .then((data) => {
        if (!cancelled && data?.tenant?.vertical !== undefined) {
          setVertical(data.tenant.vertical);
        }
      })
      .catch(() => {
        // Best-effort only — a failed lookup keeps the default AUTOMOTIVE nav, never breaks the sidebar.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navGroups = buildNavGroups(vertical);

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
        {navGroups.map((group) => {
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
              {group.key === "top" ? <div aria-hidden="true" className={styles.divider} /> : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export { NAV_ITEMS };
