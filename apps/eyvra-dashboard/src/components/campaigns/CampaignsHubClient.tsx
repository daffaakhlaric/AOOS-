"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AbTestingClient } from "@/components/meta-ads/AbTestingClient";
import { AnalisaClient } from "@/components/meta-ads/AnalisaClient";
import { AuditClient } from "@/components/meta-ads/AuditClient";
import { LookalikeClient } from "@/components/meta-ads/LookalikeClient";
import { MetaAdsClient } from "@/components/meta-ads/MetaAdsClient";
import { StrategiClient } from "@/components/meta-ads/StrategiClient";
import { HubTabs, type HubTab } from "@/components/layout/HubTabs";
import { TopBar } from "@/components/layout/TopBar";
import { ObjectiveClient } from "@/components/objective/ObjectiveClient";
import type { SettingsDto } from "@/types/tenant.types";

import { MetricsTab } from "./MetricsTab";
import styles from "./CampaignsHubClient.module.css";

const DEFAULT_TAB = "aktif";

const TABS: readonly HubTab[] = [
  { key: "metrics", label: "Metrics" },
  { key: "aktif", label: "Aktif" },
  { key: "verdict", label: "Verdict" },
  { key: "ab", label: "A/B Testing" },
  { key: "anggaran", label: "Anggaran" },
  { key: "objective", label: "Objective" },
];

const VALID_TAB_KEYS = new Set(TABS.map((tab) => tab.key));

function resolveInitialTab(initialTab: string | undefined): string {
  return initialTab !== undefined && VALID_TAB_KEYS.has(initialTab) ? initialTab : DEFAULT_TAB;
}

export interface CampaignsHubClientProps {
  readonly initialTab?: string;
}

/**
 * EYVRA MENU RESTRUCTURE Sprint 2 — real "Campaign" hub (PROMPT 3), gathering every Samantha
 * (Meta Ads) feature behind one tab bar. Every tab body is the REAL, unmodified Client component
 * that already implemented this feature before Sprint 1 hid it behind a redirect — see each
 * import above and `page.tsx`'s own doc for the full real-component-reuse mapping.
 *
 * Mode (DEV/LIVE) badge reuses the SAME real `GET /api/settings` fetch `DashboardClient.tsx`/
 * `Sidebar.tsx` already established (`tenant.mode`) — no second "who am I" call invented.
 * "Jalankan loop ↗" is a real navigation link to `/activity`, the real hub `/meta-ads/simulasi`
 * (the actual "run Samantha × Kai × Clara" wizard, `SimulationWizardClient`) was retired into by
 * Sprint 1 — there is no separate "run the automation loop" trigger endpoint anywhere in this
 * codebase to wire a fabricated button action to, so this honestly points at the real place that
 * feature now lives instead of inventing a new action.
 *
 * `LookalikeClient` has no tab slot of its own in PROMPT 3's literal 5-tab list (Aktif/Verdict/
 * A-B Testing/Anggaran/Objective) — Sprint 1's own redirect for `/meta-ads/lookalike` sends it to
 * the bare `/campaigns` (the default tab, same as `/meta-ads` itself), so it is rendered as an
 * additional real section under the "Aktif" tab rather than fabricated a 6th tab or dropped.
 *
 * Sprint 5 Prompt 13 ADDITION: a "Metrics" tab, placed FIRST (before "Aktif") per spec — a
 * pre-drill-down summary reusing the exact same `useCampaignsSnapshot()`/`/api/campaigns` data
 * "Aktif" already reads (no new query/table — see `MetricsTab.tsx`'s own extensive docstring for
 * the real per-metric availability findings that shaped its scope, especially Revenue/ROAS/the
 * spend-vs-revenue chart, which are honestly degraded rather than fabricated).
 *
 * "Verdict" tab renders BOTH real verdict components Sprint 1 mapped here (`meta-ads/analisa` AND
 * `meta-ads/strategi` both redirect to `?tab=verdict`): `StrategiClient` first (it is the real
 * per-ad SCALE/PAUSE/FIX/REFRESH approve/reject flow PROMPT 3's own "Terapkan/Tolak" description
 * matches almost exactly), then `AnalisaClient`'s real per-branch Rp/lead verdict rollup
 * underneath as real supplementary context — not a fabricated duplicate, the two components
 * compute genuinely different real aggregations from the same snapshot.
 */
export function CampaignsHubClient({ initialTab }: CampaignsHubClientProps): React.ReactElement {
  const [tab, setTab] = useState(() => resolveInitialTab(initialTab));
  const [mode, setMode] = useState<"DEV" | "LIVE" | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? (res.json() as Promise<SettingsDto>) : null))
      .then((data) => {
        if (!cancelled && data !== null) {
          setMode(data.tenant.mode);
        }
      })
      .catch(() => {
        // Best-effort only, same discipline as `DashboardClient.tsx`'s identical fetch.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <TopBar title="Campaign" accentColor="var(--v2-menu-campaigns)" />
      <div className={styles.headerExtra}>
        <div className={styles.headerLeft}>
          {mode !== undefined ? (
            <span
              data-testid="mode-badge"
              className={styles.modeBadge}
              style={
                mode === "LIVE"
                  ? { background: "var(--v2-live-mode-bg)", color: "var(--v2-live-mode-color)" }
                  : { background: "var(--v2-dev-bg)", color: "var(--v2-dev-color)" }
              }
            >
              {mode}
            </span>
          ) : null}
        </div>
        <Link href="/activity" className={styles.runLoopButton}>
          Jalankan loop ↗
        </Link>
      </div>
      <HubTabs
        tabs={TABS}
        activeKey={tab}
        basePath="/campaigns"
        defaultKey={DEFAULT_TAB}
        onChange={setTab}
      />
      <div className={styles.tabBody} data-testid={`campaigns-tab-${tab}`}>
        {tab === "metrics" ? <MetricsTab /> : null}
        {tab === "aktif" ? (
          <>
            <MetaAdsClient />
            <section className={styles.lookalikeSection}>
              <h2 className={styles.sectionTitle}>Lookalike Audience</h2>
              <LookalikeClient />
            </section>
          </>
        ) : null}
        {tab === "verdict" ? (
          <>
            <StrategiClient />
            <section className={styles.analisaSection}>
              <h2 className={styles.sectionTitle}>Analisa per Cabang</h2>
              <AnalisaClient />
            </section>
          </>
        ) : null}
        {tab === "ab" ? <AbTestingClient /> : null}
        {tab === "anggaran" ? (
          <>
            <p className={styles.honestNote}>
              Progress bar per-campaign vs budget cap dan proyeksi otomatis belum tersedia — tidak
              ada field budget per-campaign yang real di data Meta Ads saat ini (hanya
              `budgetAllocation` bulanan tenant di Objective). Di bawah ini adalah fitur real yang
              sudah ada: Audit Biaya (efisiensi spend per funnel/cabang, real dari Meta Ads).
            </p>
            <AuditClient />
          </>
        ) : null}
        {tab === "objective" ? <ObjectiveClient /> : null}
      </div>
    </main>
  );
}

export default CampaignsHubClient;
