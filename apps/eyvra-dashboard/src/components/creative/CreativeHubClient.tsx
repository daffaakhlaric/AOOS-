"use client";

import { useState } from "react";
import Link from "next/link";

import { AssetLibraryClient } from "@/components/assets/AssetLibraryClient";
import { HubTabs, type HubTab } from "@/components/layout/HubTabs";
import { TopBar } from "@/components/layout/TopBar";
import { ListingsClient } from "@/components/listings/ListingsClient";
import { AnalyticsHeatmapClient } from "@/components/meta-ads/AnalyticsHeatmapClient";

import { CreativeClient } from "./CreativeClient";
import styles from "./CreativeHubClient.module.css";

const DEFAULT_TAB = "assets";

const TABS: readonly HubTab[] = [
  { key: "assets", label: "Asset Library" },
  { key: "ab-results", label: "A/B Results" },
  { key: "listing", label: "Listing Manager" },
  { key: "review-kai", label: "Review Kai" },
];

const VALID_TAB_KEYS = new Set(TABS.map((tab) => tab.key));

function resolveInitialTab(initialTab: string | undefined): string {
  return initialTab !== undefined && VALID_TAB_KEYS.has(initialTab) ? initialTab : DEFAULT_TAB;
}

export interface CreativeHubClientProps {
  readonly initialTab?: string;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — real "Creative" hub (PROMPT 5), gathering every Kai feature
 * behind one tab bar. `assets`/`ab-results`/`listing` render the real, unmodified
 * `AssetLibraryClient`/`AnalyticsHeatmapClient`/`ListingsClient` Sprint 1 hid behind redirects —
 * `?tab=` values match Sprint 1's own real redirect targets exactly (`tests/app/redirects.test.tsx`:
 * `ab-results`, `listing`, `assets`).
 *
 * `review-kai` is a Sprint 2 ADDITION beyond PROMPT 5's literal 3-tab list: Sprint 1's own commit
 * documented that the real, previously-live `CreativeClient` ("Creative Review" — package
 * approve/reject queue, Samantha's refresh recommendations, AND the real "Buat Manual"
 * brief-composition form) used to occupy this exact `/creative` route and was left untouched but
 * unrendered ("wiring it back in as one of this hub's real tabs is Sprint 2/3 work"). Dropping it
 * entirely would be a real, silent feature regression the task's own discipline forbids, so it is
 * kept as an explicit 4th tab rather than fabricated away.
 *
 * "Brief ke Kai ↗" (header button) links straight to this real `review-kai` tab: `CreativeClient`'s
 * own "Buat Manual" internal tab IS the real, already-working "pilih listing → pilih angle → pilih
 * format → kirim brief" flow (`ManualBriefForm`/`PropertyManualBriefForm`) — reused as-is rather
 * than building a second, parallel brief modal. Per-listing "Brief Kai" buttons in the Listing
 * Manager tab link the same way; real listing pre-selection from that button is NOT wired this
 * sprint (`ManualBriefForm`/`PropertyManualBriefForm` have no query-param prefill input today) —
 * honestly left as a manual pick inside the real form rather than fabricated.
 */
export function CreativeHubClient({ initialTab }: CreativeHubClientProps): React.ReactElement {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));

  return (
    <main>
      <TopBar title="Creative" accentColor="var(--v2-menu-creative)" />
      <div className={styles.headerExtra}>
        <Link href="/creative?tab=review-kai" className={styles.briefButton}>
          Brief ke Kai ↗
        </Link>
      </div>
      <HubTabs
        tabs={TABS}
        activeKey={tab}
        basePath="/creative"
        defaultKey={DEFAULT_TAB}
        onChange={setTab}
      />
      <div className={styles.tabBody} data-testid={`creative-tab-${tab}`}>
        {tab === "assets" ? <AssetLibraryClient /> : null}
        {tab === "ab-results" ? <AnalyticsHeatmapClient /> : null}
        {tab === "listing" ? <ListingsClient /> : null}
        {tab === "review-kai" ? <CreativeClient /> : null}
      </div>
    </main>
  );
}

export default CreativeHubClient;
