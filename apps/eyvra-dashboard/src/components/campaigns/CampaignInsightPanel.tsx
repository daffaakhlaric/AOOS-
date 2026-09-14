"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/analytics/MetricCard";
import { CampaignAdDrillDown } from "@/components/campaigns/CampaignAdDrillDown";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type {
  CampaignInsightActionPriority,
  CampaignInsightAdDto,
  CampaignInsightResponseDto,
  CampaignSummaryDto,
} from "@/types/dashboard.types";
import type { MarketSignalsDto } from "@/types/market-signals.types";

import { aggregateCampaign, computeCpl, ctrFromAggregate, rphChatIDR } from "./campaignInsightMath";
import styles from "./CampaignInsightPanel.module.css";

export interface CampaignInsightPanelProps {
  readonly campaign: CampaignSummaryDto;
  readonly benchmarkCplIDR: number | null;
  readonly onClose: () => void;
}

const PRIORITY_LABEL: Readonly<Record<CampaignInsightActionPriority, string>> = {
  SEGERA: "Segera",
  MINGGU_INI: "Minggu ini",
  BULAN_INI: "Bulan ini",
};

const PRIORITY_ORDER: readonly CampaignInsightActionPriority[] = [
  "SEGERA",
  "MINGGU_INI",
  "BULAN_INI",
];

/**
 * SAMANTHA ADVANCED SPRINT 2 — real per-ad breakdown for `CampaignInsightRequestDto.ads`, built
 * from the SAME `campaign.adSets` tree `CampaignAdDrillDown` already renders (never a second Meta
 * pull, never re-derived numbers) — the exact `rphChatIDR` ratio that component's own diagnosis
 * request already computes, shared via `campaignInsightMath.ts` so the two surfaces can never drift.
 */
function buildInsightAds(campaign: CampaignSummaryDto): readonly CampaignInsightAdDto[] {
  return campaign.adSets.flatMap((adSet) =>
    adSet.ads.map((ad) => ({
      stableId: ad.stableId,
      name: ad.name,
      verdict: ad.verdict,
      spend: ad.metrics.spend,
      conversations: ad.metrics.conversations,
      rphChatIDR: rphChatIDR(ad.metrics.spend, ad.metrics.conversations),
      frequency: ad.metrics.frequency,
      learningStatus: adSet.learningStatus,
    })),
  );
}

/** Real `stableId`s of ad sets still in Meta's Learning Phase — same `"LEARNING"` check `CampaignAdDrillDown.tsx`'s own `🎓 Learning` badge already uses. */
function buildLearningAdSetStableIds(campaign: CampaignSummaryDto): readonly string[] {
  return campaign.adSets
    .filter((adSet) => adSet.learningStatus === "LEARNING")
    .map((adSet) => adSet.stableId);
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the unified page's click-to-expand insight panel (spec: "6 KPI
 * mini + narasi + action list prioritized"). Opens when a row is clicked in `UnifiedCampaignTable`.
 *
 * 6 KPI cards use the exact same `aggregateCampaign` math `UnifiedCampaignTable`'s own row uses
 * (never a second, possibly-drifting aggregation) — Spend/CPL/CTR/Impressions/Frequency/Results,
 * per spec. CTR/Impressions honestly show "Belum tersedia" when no ad in this campaign carries a
 * real `impressions` value (see `AdMetricsDto.impressions`'s own doc — optional, not every fixture
 * populates it).
 *
 * The narrative + prioritized action list is a REAL LLM call (`POST /api/campaign-insight` →
 * `aaos-api`'s `LlmService.campaignInsight`), fetched on-demand only when a campaign is selected
 * (not for every campaign on page load — an LLM call per row on every page view would be wasteful
 * and is not what "click untuk melihat detail" asks for). Honest degrade: `available: false` (no
 * API key / rate-limited / provider error / invalid response) renders a real, non-fabricated
 * message instead of invented narrative text — same discipline every other real LLM-backed surface
 * in this app follows.
 *
 * A/B Testing note: the pre-rebuild "A/B Testing" tab (`AbTestingClient` — real RUNNING/COMPLETE/
 * DRAFT formal test management) has no bottom-strip card in this unified page's spec and is
 * genuinely DISTINCT content from Creative's own "A/B Results" heatmap/WinningCombos tab (test
 * *management* vs. ranked creative-performance *analysis*) — dropping it silently would lose real
 * functionality. It stays reachable via the real link below (`/campaigns?view=ab-testing`, handled
 * by `CampaignsHubClient.tsx`'s own real escape hatch) rather than being deleted.
 *
 * SAMANTHA ADVANCED SPRINT 1 additions:
 *  - Real `campaign.objective` chip in the header (the user's own explicit feedback: "objective
 *    settingannya juga keliatan" — this sprint's scope is honestly showing the CURRENT value only,
 *    not a "what to fix" recommendation engine, which is a separate, later sprint's scope).
 *  - `CampaignAdDrillDown` — a real per-ad-set → per-ad hierarchy for THIS selected campaign,
 *    rendered below the KPI grid. `CampaignTree.tsx`'s own docstring claimed it already "powers the
 *    real per-ad-set/ad drill-down inside `CampaignInsightPanel`'s 'detail' affordance" — but this
 *    file, read in full, never imported the `CampaignTree` component (only its `aggregateVerdict`
 *    helper) and rendered no ad-set/ad hierarchy at all. That claim was stale: `CampaignTree` is
 *    real and working, but wired only into the legacy `/meta-ads` page (`MetaAdsClient.tsx`), not
 *    reachable from here. `CampaignAdDrillDown` is the real, new detail affordance this file needed.
 */
export function CampaignInsightPanel({
  campaign,
  benchmarkCplIDR,
  onClose,
}: CampaignInsightPanelProps): React.ReactElement {
  const [insight, setInsight] = useState<CampaignInsightResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);
  // SAMANTHA ADVANCED SPRINT 2 — real, already-persisted Market Intelligence digest for this
  // tenant's vertical (see `MarketSignalsCard.tsx`'s own real fetch of the same endpoint). `undefined`
  // until this best-effort fetch resolves (or forever, if it fails) — the campaign-insight request
  // below is composed with whatever this state holds AT THAT MOMENT and never blocks/waits on it.
  const [marketDigest, setMarketDigest] = useState<string | null | undefined>(undefined);

  // Real bug fix (live-confirmed report, see `VerdictCards.tsx`'s own identical fix and doc): a
  // delayed/partial ad-level Meta Insights pull can leave `campaign.adSets` genuinely empty/zeroed
  // while the campaign-level Insights row (`campaign.spend`) already has the real number. Before
  // this fix, both the KPI grid AND the `/api/campaign-insight` request body silently sent the
  // misleading ad-level Rp 0 — which is exactly why Samantha's narrative stayed generic/aggregate-
  // only: she was being told (honestly, per her own data) that this campaign spent nothing, so she
  // had no real per-ad signal to reason about. Falling back to the real `campaign.spend` (never
  // paired with a CPL that has no real relationship to it) fixes the KPI display AND gives the LLM
  // the real, non-zero spend context it needs.
  const aggregate = aggregateCampaign(campaign);
  const adLevelSpendAvailable = aggregate.spend > 0;
  const displaySpend = adLevelSpendAvailable ? aggregate.spend : campaign.spend;
  const cpl = adLevelSpendAvailable ? computeCpl(aggregate.spend, aggregate.totalLead) : null;
  const ctr = ctrFromAggregate(aggregate);
  const verdict = aggregateVerdict(
    campaign.adSets.flatMap((adSet) => adSet.ads.map((ad) => ad.verdict)),
  );

  useEffect(() => {
    let cancelled = false;
    setInsight(undefined);
    setFetchError(undefined);
    setLoading(true);
    fetch("/api/campaign-insight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        campaignName: campaign.name,
        verdict,
        spend: displaySpend,
        totalLead: aggregate.totalLead,
        clicks: aggregate.clicks,
        impressions: aggregate.impressions,
        maxFrequency: aggregate.maxFrequency,
        adCount: aggregate.adCount,
        adSetCount: aggregate.adSetCount,
        cpl,
        benchmarkCplIDR,
        ads: buildInsightAds(campaign),
        learningAdSetStableIds: buildLearningAdSetStableIds(campaign),
        marketDigest,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat analisa Samantha.");
        }
        return (await res.json()) as CampaignInsightResponseDto;
      })
      .then((body) => {
        if (!cancelled) {
          setInsight(body);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFetchError(
            caught instanceof Error ? caught.message : "Gagal memuat analisa Samantha.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch only when the selected campaign genuinely changes — `benchmarkCplIDR` is stable for
    // a given page session, `aggregate`/`cpl`/`verdict` are pure derivations of `campaign` itself.
    // `marketDigest` is deliberately NOT a dependency (see its own doc above) — using whatever value
    // it holds right now, not re-triggering a second campaign-insight call when it later resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

  // SAMANTHA ADVANCED SPRINT 2 — real, best-effort fetch of this tenant's persisted Market
  // Intelligence digest (`GET /api/market-signals/latest`, the SAME endpoint `MarketSignalsCard.tsx`
  // already reads — no new backend call site). Declared AFTER the campaign-insight effect above so
  // its own fetch always fires first on a given commit; intentionally NOT campaign-scoped (the
  // digest is tenant/vertical-level, not per-campaign) and never blocks/fails the insight panel —
  // any error here just leaves `marketDigest` `undefined`, an honest "not available" the prompt
  // schema already treats as optional.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/market-signals/latest")
      .then(async (res) => {
        if (!res.ok) {
          return undefined;
        }
        return (await res.json()) as { signals?: MarketSignalsDto | null };
      })
      .then((body) => {
        if (!cancelled) {
          setMarketDigest(body?.signals?.digestText ?? null);
        }
      })
      .catch(() => {
        // Best-effort only — leave `marketDigest` as `undefined`, never surface this as a panel error.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section data-testid="campaign-insight-panel" className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>{campaign.name}</h3>
          <span className={styles.objectiveChip} data-testid="insight-objective">
            🎯 {campaign.objective}
          </span>
        </div>
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Tutup">
          ✕
        </button>
      </div>

      <div className={styles.kpiGrid} data-testid="insight-kpi-grid">
        <MetricCard
          label="Spend"
          value={formatIdr(displaySpend)}
          testId="insight-kpi-spend"
          {...(!adLevelSpendAvailable && displaySpend > 0
            ? { warningLabel: "Breakdown per-iklan belum tersedia, ini spend campaign" }
            : {})}
        />
        <MetricCard
          label="CPL"
          value={cpl !== null ? formatIdr(cpl) : "—"}
          testId="insight-kpi-cpl"
        />
        <MetricCard
          label="CTR"
          value={ctr !== null ? formatPercent(ctr) : "Belum tersedia"}
          testId="insight-kpi-ctr"
        />
        <MetricCard
          label="Impressions"
          value={
            aggregate.impressions !== null ? formatNumber(aggregate.impressions) : "Belum tersedia"
          }
          testId="insight-kpi-impressions"
        />
        <MetricCard
          label="Frequency"
          value={aggregate.maxFrequency.toFixed(2)}
          testId="insight-kpi-frequency"
        />
        <MetricCard
          label="Results"
          value={formatNumber(aggregate.totalLead)}
          testId="insight-kpi-results"
        />
      </div>

      <div className={styles.drillDownBlock} data-testid="insight-drilldown-block">
        <h4 className={styles.aiTitle}>Ad Set &amp; Iklan</h4>
        <CampaignAdDrillDown campaign={campaign} />
      </div>

      <div className={styles.aiBlock} data-testid="insight-ai-block">
        <h4 className={styles.aiTitle}>Analisa Samantha</h4>
        {loading ? <LoadingSpinner /> : null}
        {!loading && fetchError !== undefined ? <ErrorCard message={fetchError} /> : null}
        {!loading && insight !== undefined ? (
          insight.available ? (
            <>
              <p className={styles.narrative} data-testid="insight-narrative">
                {insight.narrative}
              </p>
              <ul className={styles.actionList} data-testid="insight-action-list">
                {PRIORITY_ORDER.flatMap((priority) =>
                  insight.actions
                    .filter((action) => action.priority === priority)
                    .map((action, index) => (
                      <li key={`${priority}-${index}`} className={styles.actionItem}>
                        <span
                          className={`${styles.priorityBadge} ${styles[`priority${priority}`]}`}
                        >
                          {PRIORITY_LABEL[priority]}
                        </span>
                        <span>{action.text}</span>
                      </li>
                    )),
                )}
              </ul>
            </>
          ) : (
            <p className={styles.unavailable} data-testid="insight-unavailable">
              Analisa belum tersedia, coba lagi nanti. ({insight.message})
            </p>
          )
        ) : null}
      </div>

      <a href="/campaigns?view=ab-testing" className={styles.abTestingLink}>
        Kelola A/B Test ↗
      </a>
    </section>
  );
}

export default CampaignInsightPanel;
