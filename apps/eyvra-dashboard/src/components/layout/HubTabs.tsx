"use client";

import { useRouter } from "next/navigation";

import styles from "./HubTabs.module.css";

export interface HubTab {
  readonly key: string;
  readonly label: string;
}

export interface HubTabsProps {
  readonly tabs: readonly HubTab[];
  readonly activeKey: string;
  readonly basePath: string;
  /** Tab whose click should NOT append `?tab=` (keeps the bare hub URL, matching Sprint 1's own redirect targets like `/campaigns`/`/leads` with no query string). */
  readonly defaultKey: string;
  readonly onChange: (key: string) => void;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — shared tab bar for the 3 new hub pages (Campaign/Leads/
 * Creative). Real client-side tab switching (no page reload) that ALSO keeps the URL in sync via
 * `router.replace` (shallow, `scroll: false`) so every deep link Sprint 1's own redirect stubs
 * already point at (`/campaigns?tab=verdict`, `/leads?tab=recycling`, `/creative?tab=assets`, …
 * confirmed against `tests/app/redirects.test.tsx`) actually lands on the right tab, and so a
 * hub's own URL is shareable/bookmarkable mid-session.
 *
 * Deliberately NOT reading `useSearchParams()` after mount (that would need a `<Suspense>`
 * boundary this repo has no precedent for) — the active tab is owned by the parent's `useState`,
 * seeded once from the Server Component's own `searchParams` prop, same real convention
 * `ClaraInboxClient`'s `initialLeadId` already established for this exact "read once server-side,
 * never client-side" split.
 */
export function HubTabs({
  tabs,
  activeKey,
  basePath,
  defaultKey,
  onChange,
}: HubTabsProps): React.ReactElement {
  const router = useRouter();

  function handleClick(key: string): void {
    onChange(key);
    const url = key === defaultKey ? basePath : `${basePath}?tab=${key}`;
    router.replace(url, { scroll: false });
  }

  return (
    <div role="tablist" className={styles.tabBar} data-testid="hub-tabs">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`hub-tab-${tab.key}`}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
            onClick={() => handleClick(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default HubTabs;
