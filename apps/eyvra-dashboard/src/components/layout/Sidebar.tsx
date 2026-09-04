"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./Sidebar.module.css";

/**
 * EYVRA MENU RESTRUCTURE Sprint 1 (Foundation) — total rebuild from the old 24-item
 * agent-centric sidebar (SAMANTHA/CLARA/KAI/OPERASIONAL sections, `buildNavGroups`,
 * per-vertical branching, collapsible groups, `localStorage` persistence) down to the spec's
 * flat 7-item intent-centric menu (Overview/Campaign/Leads/Creative/Aktivitas/AI Improve/
 * Setting). None of the 7 new items differ by tenant vertical — that per-vertical branching
 * (Scraper Mobix vs Listing Manager, Activity Log PROPERTY-only, Sosmed omitted for PROPERTY)
 * moves down into each hub page's own tabs in a later sprint, so this component no longer
 * fetches `/api/settings` for a `vertical` at all — a real, deliberate simplification, not an
 * oversight.
 *
 * Real deviations from the spec's own literal text (spec written before it saw this codebase):
 *  - Icon set: the spec's `ti-*` classes assume Tabler Icons. This app has NEVER depended on
 *    Tabler (or any icon font/component library) — every existing nav item already used a plain
 *    emoji glyph (`Sidebar.module.css`'s pre-restructure `.navIcon` comment: "these are emoji
 *    glyphs, not an SVG icon set"). Adding a brand-new icon dependency for a Sprint-1 foundation
 *    pass isn't justified, so each `ti-*` name below is translated to the closest existing (or
 *    equivalent) emoji, reusing the SAME glyph the old sidebar already used for that concept
 *    wherever one existed:
 *      ti-layout-dashboard -> 🎯 (= old OVERVIEW's own glyph, unchanged)
 *      ti-speakerphone     -> 📣 (megaphone/announcement, closest real emoji to "speakerphone")
 *      ti-flame             -> 🔥 (exact emoji match)
 *      ti-photo              -> 🎨 (= old CREATIVE's own glyph — "photo" translated to this
 *                                    app's existing "creative" concept glyph for continuity)
 *      ti-activity          -> 🪵 (= old ACTIVITY_LOG's own glyph, unchanged)
 *      ti-brain              -> 🧠 (exact emoji match, = old LEARNING_MONITOR's own glyph)
 *      ti-settings           -> ⚙️ (exact emoji match, = old SETTINGS's own glyph, unchanged)
 *  - Colors: the spec hardcodes 7 literal hex values. `globals.css`'s "AAOS Colorful Brand
 *    Guideline v2" block already defines `--v2-menu-overview`/`-campaigns`/`-leads`/`-creative`/
 *    `-activity`/`-improve`/`-settings` tokens — SIX of which were pre-existing before this
 *    sprint (added for the old grouped sidebar) and the other two (`-activity`, `-improve`) were
 *    already sitting there unused, evidently pre-provisioned for exactly this restructure. Reusing
 *    these existing design-system tokens (their values are close to, but not always identical to,
 *    the spec's literal hex — e.g. `--v2-menu-activity: #6366f1` vs spec's `#818CF8`) is more
 *    honest than hardcoding a second, parallel set of one-off hex constants that would drift from
 *    the app's real palette.
 *  - Routes: the spec assumes every route lives under a `/property/*` prefix. This app has NEVER
 *    had vertical-prefixed routing — both AUTOMOTIVE and PROPERTY tenants share the same
 *    unprefixed routes (`/dashboard`, `/meta-ads`, `/clara/*`, …), vertical is resolved from the
 *    session server-side, not the URL. The 7 routes below are un-prefixed, matching this app's
 *    real, existing convention (see this file's own routing history above) rather than forcing a
 *    `/property/` prefix that has no real precedent here. `Overview` keeps the real, already-
 *    shipped `/dashboard` route (spec's own "already exists, keep" instruction for Overview);
 *    `Setting` keeps the real, already-shipped `/settings` route (this sprint's task explicitly
 *    defers the real Settings rebuild to a later sprint — Prompt 8 — so it's touched minimally
 *    here, just re-pointed at by the new sidebar).
 */
export interface MenuItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  /** Key used for the `data-item` attribute the CSS active/hover rules below select on. */
  readonly key: string;
  /** Name of the `--v2-menu-*` CSS custom property (defined in `globals.css`) for this item. */
  readonly colorVar: string;
}

export const MENU: readonly MenuItem[] = [
  {
    key: "overview",
    href: "/dashboard",
    label: "Overview",
    icon: "🎯",
    colorVar: "--v2-menu-overview",
  },
  {
    key: "campaign",
    href: "/campaigns",
    label: "Campaign",
    icon: "📣",
    colorVar: "--v2-menu-campaigns",
  },
  { key: "leads", href: "/leads", label: "Leads", icon: "🔥", colorVar: "--v2-menu-leads" },
  {
    key: "creative",
    href: "/creative",
    label: "Creative",
    icon: "🎨",
    colorVar: "--v2-menu-creative",
  },
  // divider
  {
    key: "activity",
    href: "/activity",
    label: "Aktivitas",
    icon: "🪵",
    colorVar: "--v2-menu-activity",
  },
  {
    key: "improve",
    href: "/self-improve",
    label: "AI Improve",
    icon: "🧠",
    colorVar: "--v2-menu-improve",
  },
] as const satisfies readonly MenuItem[];

/** Rendered separately, pinned to the bottom of the rail via `styles.settingsRow`'s `margin-top: auto` (spec "Settings di bawah dengan margin-top auto"). */
export const SETTINGS_ITEM: MenuItem = {
  key: "settings",
  href: "/settings",
  label: "Setting",
  icon: "⚙️",
  colorVar: "--v2-menu-settings",
};

/** Flat list of every real nav destination, in on-screen order — `MobileNav.tsx`'s bottom tab bar slices `[0, 5)` from this. */
export const NAV_ITEMS: readonly MenuItem[] = [...MENU, SETTINGS_ITEM];

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

function MenuLink({
  item,
  active,
}: {
  readonly item: MenuItem;
  readonly active: boolean;
}): React.ReactElement {
  return (
    <Link
      href={item.href}
      data-item={item.key}
      className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
      aria-current={active ? "page" : undefined}
      style={{ ["--item-color" as string]: `var(${item.colorVar})` }}
    >
      <span aria-hidden="true" className={styles.navIcon}>
        {item.icon}
      </span>
      <span className={styles.navLabel}>{item.label}</span>
    </Link>
  );
}

/**
 * Desktop navigation rail (spec "components/layout/Sidebar.tsx") — hidden below `md`, where
 * `MobileNav` takes over. EYVRA MENU RESTRUCTURE Sprint 1: flat 72px icon+label rail, 7 items,
 * no section headers, no sub-menus, no collapsible groups — see this file's class doc for the
 * real deviations from the spec's literal `ti-*`/hex/`/property/*` assumptions.
 */
export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi utama" className={styles.sidebar}>
      <div className={styles.logo}>
        <span aria-hidden="true" className={styles.logoMark}>
          E
        </span>
      </div>
      <div className={styles.nav}>
        {MENU.slice(0, 4).map((item) => (
          <MenuLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div aria-hidden="true" className={styles.divider} />
        {MENU.slice(4).map((item) => (
          <MenuLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
      <div className={styles.settingsRow}>
        <div aria-hidden="true" className={styles.divider} />
        <MenuLink item={SETTINGS_ITEM} active={isActive(pathname, SETTINGS_ITEM.href)} />
      </div>
    </nav>
  );
}
