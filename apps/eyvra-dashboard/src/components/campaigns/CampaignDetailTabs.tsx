"use client";

import { useState } from "react";

import type { CampaignSummaryDto } from "@/types/dashboard.types";

import { AndromedaHealthCard } from "./AndromedaHealthCard";
import { AutomationPanel } from "./AutomationPanel";
import { BudgetTracker } from "./BudgetTracker";
import { CampaignHealthCard } from "./CampaignHealthCard";
import { OpportunitiesCard } from "./OpportunitiesCard";
import styles from "./CampaignDetailTabs.module.css";

export interface CampaignDetailTabsProps {
  /** The full, currently-selected campaign summary — needed as-is (not just id/name) because the
   * real "Anggaran" tab reuses `BudgetTracker`, which takes a `campaigns` array and computes its
   * own real pacing/estimate math from each campaign's already-loaded `adSets`. */
  readonly campaign: CampaignSummaryDto;
  readonly listingId?: string;
  readonly onApplyVerdict: (verdict: string) => void;
}

type TabKey = "overview" | "creative-health" | "budget";

const TABS: ReadonlyArray<{ readonly key: TabKey; readonly label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "creative-health", label: "Creative Health" },
  { key: "budget", label: "Anggaran" },
];

/**
 * `CampaignDetailTabs` (EYVRA Samantha V2 + Kai V2 Phase 51 — PROMPT 77/78/79/80, Campaign Detail
 * redesign) — the mockup's panel 3 tab bar (Overview/Performance/Creative Health/Lead Quality/
 * Budget/Experiments/History), scoped honestly to the real, already-built components this codebase
 * actually has per-campaign data for.
 *
 * REAL COMPONENTS REUSED, never rebuilt/re-derived — this component owns NO data-fetching or
 * decision logic of its own, it only arranges already-real cards:
 *  - Overview: `CampaignHealthCard` (Phase 14's real health/diagnosis/decision — the mockup's
 *    "Samantha Decision card": root cause, plan, Approve/Modify-equivalent "Terapkan Verdict"/
 *    "Brief Kai" buttons, evidence via its own dimension grid) next to the new `AutomationPanel`
 *    (Phase 51 — mode/next-review/success+rollback, PROMPT 79).
 *  - Creative Health: `AndromedaHealthCard` (creative-diversity/fatigue) + `OpportunitiesCard`
 *    (real `CREATIVE_WINNER_EXPANSION`/`SCALING_OPPORTUNITY` detectors).
 *  - Anggaran (Budget): `BudgetTracker`, reused with a single-campaign `campaigns` array so its
 *    already-real per-campaign pacing/estimate math renders for just this campaign — no new
 *    component, no new endpoint.
 *
 * HONEST OMISSIONS (tabs the mockup names but this codebase has no real per-campaign data for —
 * skipped from the tab bar entirely rather than shown with fabricated content):
 *  - "Performance": `CampaignInsightPanel` (the real LLM-backed metrics/playbook analysis) already
 *    renders immediately below the campaign table in `CampaignsHubClient` today, opened by the same
 *    row click that opens this tab bar. Duplicating it as a fourth tab here would either fork its
 *    real data-fetching or hide it behind an extra click that would break its own existing "row
 *    click -> insight panel opens" regression coverage — left in its current, already-real position
 *    instead of moved or duplicated.
 *  - "Lead Quality": this session's backend audits repeatedly confirmed there is NO real CRM/lead-
 *    stage/lead-quality-score data anywhere in this codebase (`skills/foundation/missing-three.md`
 *    and multiple earlier phase docs) — omitted rather than faked.
 *  - "Experiments": `AbTestingClient` (the real A/B test lifecycle manager) has no `campaignId`
 *    field or filter anywhere in its own real data/props — it is tenant-wide, not per-campaign, so
 *    there is nothing real to scope into a per-campaign tab. It stays reachable via the existing
 *    `?view=ab-testing` escape hatch `CampaignsHubClient` already established.
 *  - "History": `CampaignHealthCard`'s own `TrendSection` (real `compare-latest` assessment
 *    comparison) already renders inside the Overview tab's `CampaignHealthCard` — duplicating it as
 *    a separate tab would mean either a second fetch of the same endpoint for a purely cosmetic
 *    split, or surgically extracting internal state out of `CampaignHealthCard` (risking its own
 *    passing test suite) for no new real data. Left where it already, honestly, is.
 */
export function CampaignDetailTabs({
  campaign,
  listingId,
  onApplyVerdict,
}: CampaignDetailTabsProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <section data-testid="campaign-detail-tabs" className={styles.section}>
      <div role="tablist" aria-label="Campaign detail" className={styles.tabList}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            data-testid={`campaign-detail-tab-${tab.key}`}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div data-testid="campaign-detail-panel-overview" className={styles.overviewGrid}>
          <div className={styles.overviewMain}>
            <CampaignHealthCard
              campaignId={campaign.metaId}
              campaignName={campaign.name}
              listingId={listingId}
              onApplyVerdict={onApplyVerdict}
            />
          </div>
          <div className={styles.overviewSide}>
            <AutomationPanel campaignId={campaign.metaId} campaignName={campaign.name} />
          </div>
        </div>
      ) : null}

      {activeTab === "creative-health" ? (
        <div data-testid="campaign-detail-panel-creative-health">
          <AndromedaHealthCard
            campaignId={campaign.metaId}
            campaignName={campaign.name}
            listingId={listingId}
          />
          <OpportunitiesCard campaignId={campaign.metaId} campaignName={campaign.name} />
        </div>
      ) : null}

      {activeTab === "budget" ? (
        <div data-testid="campaign-detail-panel-budget">
          <BudgetTracker campaigns={[campaign]} />
        </div>
      ) : null}
    </section>
  );
}

export default CampaignDetailTabs;
