"use client";

import { useEffect, useState } from "react";

import { MetricCard, type MetricCardDelta } from "@/components/analytics/MetricCard";
import { CampaignAdDrillDown } from "@/components/campaigns/CampaignAdDrillDown";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type {
  CampaignHistoryPointDto,
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
 * Campaign Page Rebuild v2 — verdict header config. Real 6-value `Verdict` vocabulary
 * (`@aos/meta-ads-connector`'s own enum: SCALE/KEEP/REVIEW/REFRESH/FIX/PAUSE) — the pasted spec's
 * own "CREATIVE" verdict does not exist anywhere in this codebase; `REFRESH` (Meta's real
 * creative-fatigue verdict) is the honest match for that same real-world meaning.
 */
const VERDICT_CONFIG: Readonly<
  Record<
    string,
    { readonly bg: string; readonly border: string; readonly icon: string; readonly label: string }
  >
> = {
  SCALE: { bg: "#ecfdf5", border: "#a7f3d0", icon: "↑", label: "SCALE" },
  KEEP: { bg: "#f8fafc", border: "#e2e8f0", icon: "✓", label: "KEEP" },
  REFRESH: { bg: "#fffbeb", border: "#fde68a", icon: "✦", label: "PERLU KONTEN" },
  PAUSE: { bg: "#fef2f2", border: "#fecaca", icon: "∥", label: "PAUSE" },
  FIX: { bg: "#fff7ed", border: "#fed7aa", icon: "⚠", label: "FIX DULU" },
  REVIEW: { bg: "#eff6ff", border: "#bfdbfe", icon: "◎", label: "REVIEW" },
};
const DEFAULT_VERDICT_CONFIG = VERDICT_CONFIG.KEEP!;

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

/** Real, honest percent-change delta between the first and last real history point — `undefined` when fewer than 2 real points exist (never a fabricated 0% delta). */
function deltaFrom(
  points: readonly CampaignHistoryPointDto[],
  pick: (point: CampaignHistoryPointDto) => number,
  higherIsBetter: boolean,
): MetricCardDelta | undefined {
  if (points.length < 2) {
    return undefined;
  }
  const first = pick(points[0]!);
  const last = pick(points[points.length - 1]!);
  if (first === 0) {
    return undefined;
  }
  return { percent: ((last - first) / first) * 100, higherIsBetter };
}

/**
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the unified page's click-to-expand insight panel (spec: "6 KPI
 * mini + narasi + action list prioritized").
 *
 * Campaign Page Rebuild v2 — REBUILT: a verdict header bar (real `verdict`, already computed
 * client-side, was previously never shown in this panel at all — only the `objective` chip was);
 * real 7-day sparklines/deltas on each KPI card, fed from the new, real
 * `GET /api/campaigns/:campaignId/history` (`meta_insights_daily` read-back — see that route's own
 * doc for why this was previously impossible to build honestly, `MetricCard`'s own sparkline prop
 * had existed unused for exactly this reason); a real CPL-vs-benchmark visual bar; and the old
 * free-form `narrative` paragraph replaced by Samantha's new, sharper `diagnosis` +
 * `metricEvidence` + optional `contextNote` structure (see `aaos-api`'s `CAMPAIGN_INSIGHT_SYSTEM_
 * PROMPT` for the real prompt change behind this). Andromeda health is deliberately NOT duplicated
 * here — `AndromedaHealthCard` already renders immediately after this panel (see that component's
 * own "PLACEMENT" doc), so a second, redundant mini-widget here would just drift from that one.
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
  // Campaign Page Rebuild v2 — real, best-effort 7-day history for sparklines/deltas + the CTR
  // trend context Samantha's own prompt can cite. `undefined` while loading/unavailable — every
  // sparkline/delta below honestly renders nothing rather than a fabricated flat line.
  const [history, setHistory] = useState<readonly CampaignHistoryPointDto[] | undefined>(undefined);

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
  const verdictConfig = VERDICT_CONFIG[verdict] ?? DEFAULT_VERDICT_CONFIG;

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
        ctrTrend7d: history?.map((point) => point.ctr),
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
    // `marketDigest`/`history` are deliberately NOT dependencies — using whatever value they hold
    // right now, not re-triggering a second campaign-insight call when either resolves later.
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

  // Campaign Page Rebuild v2 — real, best-effort fetch of this campaign's 7-day history
  // (`meta_insights_daily` read-back) for sparklines/deltas. Campaign-scoped, keyed by the real,
  // stable `metaId` (never `id` — see `CampaignSummaryDto.metaId`'s own doc for why `id` alone is
  // unsafe across a separate request). Best-effort: a failure here just leaves every sparkline/
  // delta below honestly absent, never blocks or fails the rest of the panel.
  useEffect(() => {
    let cancelled = false;
    setHistory(undefined);
    fetch(`/api/campaigns/${encodeURIComponent(campaign.metaId)}/history?days=7`)
      .then(async (res) => {
        if (!res.ok) {
          return undefined;
        }
        return (await res.json()) as { points?: readonly CampaignHistoryPointDto[] };
      })
      .then((body) => {
        if (!cancelled) {
          setHistory(body?.points ?? []);
        }
      })
      .catch(() => {
        // Best-effort only — sparklines/deltas just stay absent.
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.metaId]);

  const cplRatio =
    cpl !== null && benchmarkCplIDR !== null && benchmarkCplIDR > 0 ? cpl / benchmarkCplIDR : null;

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

      <div
        className={styles.verdictHeader}
        data-testid="insight-verdict-header"
        style={{ background: verdictConfig.bg, borderColor: verdictConfig.border }}
      >
        <div className={styles.verdictIcon} style={{ background: verdictConfig.border }}>
          {verdictConfig.icon}
        </div>
        <div className={styles.verdictBody}>
          <span
            className={styles.verdictBadge}
            data-testid="insight-verdict-badge"
            style={{ background: verdictConfig.border }}
          >
            {verdictConfig.label}
          </span>
          {!loading && insight?.available === true ? (
            <p className={styles.diagnosis} data-testid="insight-diagnosis">
              {insight.diagnosis}
            </p>
          ) : null}
        </div>
      </div>

      <div className={styles.kpiGrid} data-testid="insight-kpi-grid">
        <MetricCard
          label="Spend"
          value={formatIdr(displaySpend)}
          testId="insight-kpi-spend"
          sparkline={history?.map((point) => point.spend)}
          {...(!adLevelSpendAvailable && displaySpend > 0
            ? { warningLabel: "Breakdown per-iklan belum tersedia, ini spend campaign" }
            : {})}
        />
        <MetricCard
          label="CPL"
          value={cpl !== null ? formatIdr(cpl) : "—"}
          testId="insight-kpi-cpl"
          sparkline={history?.map((point) => point.cpl)}
          delta={history !== undefined ? deltaFrom(history, (p) => p.cpl, false) : undefined}
        />
        <MetricCard
          label="CTR"
          value={ctr !== null ? formatPercent(ctr) : "Belum tersedia"}
          testId="insight-kpi-ctr"
          sparkline={history?.map((point) => point.ctr)}
          delta={history !== undefined ? deltaFrom(history, (p) => p.ctr, true) : undefined}
        />
        <MetricCard
          label="Impressions"
          value={
            aggregate.impressions !== null ? formatNumber(aggregate.impressions) : "Belum tersedia"
          }
          testId="insight-kpi-impressions"
          sparkline={history?.map((point) => point.impressions)}
        />
        <MetricCard
          label="Frequency"
          value={aggregate.maxFrequency.toFixed(2)}
          testId="insight-kpi-frequency"
          sparkline={history?.map((point) => point.frequency)}
        />
        <MetricCard
          label="Results"
          value={formatNumber(aggregate.totalLead)}
          testId="insight-kpi-results"
          sparkline={history?.map((point) => point.leads)}
          delta={history !== undefined ? deltaFrom(history, (p) => p.leads, true) : undefined}
        />
      </div>

      {cplRatio !== null ? (
        <div className={styles.cplBarBlock} data-testid="insight-cpl-bar">
          <div className={styles.cplBarLabelRow}>
            <span>Rp 0</span>
            <span>Benchmark {formatIdr(benchmarkCplIDR as number)}</span>
            <span>{formatIdr((benchmarkCplIDR as number) * 2)}</span>
          </div>
          <div className={styles.cplBarTrack}>
            <div className={styles.cplBarBenchmarkLine} />
            <div
              className={styles.cplBarFill}
              style={{
                width: `${Math.min((cplRatio / 2) * 100, 100)}%`,
                background: cplRatio < 0.85 ? "#10b981" : cplRatio <= 1.15 ? "#f59f00" : "#ef4444",
              }}
            />
          </div>
          <p
            className={styles.cplBarNote}
            style={{ color: cplRatio < 1 ? "#059669" : "#dc2626" }}
            data-testid="insight-cpl-bar-note"
          >
            {cplRatio < 1
              ? `${Math.round((1 - cplRatio) * 100)}% lebih murah dari benchmark`
              : `${Math.round((cplRatio - 1) * 100)}% lebih mahal dari benchmark`}
          </p>
        </div>
      ) : null}

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
              <ul className={styles.evidenceList} data-testid="insight-evidence-list">
                {insight.metricEvidence.map((evidence, index) => (
                  <li key={index} className={styles.evidenceItem}>
                    <span className={styles.evidenceIcon}>{evidence.icon}</span>
                    <span className={styles.evidenceMetric}>{evidence.metric}</span>
                    <span className={styles.evidenceInterpretation}>{evidence.interpretation}</span>
                  </li>
                ))}
              </ul>
              {insight.contextNote !== undefined ? (
                <p className={styles.contextNote} data-testid="insight-context-note">
                  {insight.contextNote}
                </p>
              ) : null}
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
                        {action.estimatedImpact !== undefined ? (
                          <span className={styles.actionImpact}>{action.estimatedImpact}</span>
                        ) : null}
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
