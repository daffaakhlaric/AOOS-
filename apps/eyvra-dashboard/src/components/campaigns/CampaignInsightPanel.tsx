"use client";

import { useEffect, useState } from "react";

import { MetricCard, type MetricCardDelta } from "@/components/analytics/MetricCard";
import { CampaignAdDrillDown } from "@/components/campaigns/CampaignAdDrillDown";
import { aggregateVerdict } from "@/components/meta-ads/CampaignTree";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { AndromedaHealthDto } from "@/types/andromeda-health.types";
import type {
  CampaignHistoryPointDto,
  CampaignInsightBudgetRecommendation,
  CampaignInsightResponseDto,
  CampaignInsightTriageLevel,
  CampaignSummaryDto,
  LeadDto,
} from "@/types/dashboard.types";
import type { MarketSignalsDto } from "@/types/market-signals.types";

import {
  aggregateCampaign,
  computeCpl,
  cpcFromAggregate,
  cpmFromAggregate,
  ctrFromAggregate,
  rphChatIDR,
} from "./campaignInsightMath";
import styles from "./CampaignInsightPanel.module.css";

export interface CampaignInsightPanelProps {
  readonly campaign: CampaignSummaryDto;
  readonly benchmarkCplIDR: number | null;
  readonly onClose: () => void;
}

/**
 * SAMANTHA ADVANCED INSIGHT ENGINE — real 6-value `Verdict` vocabulary (`@aos/meta-ads-connector`'s
 * own enum: SCALE/KEEP/REVIEW/REFRESH/FIX/PAUSE) — the pasted spec's own "CREATIVE" verdict does
 * not exist anywhere in this codebase; `REFRESH` (Meta's real creative-fatigue verdict) is the
 * honest match for that same real-world meaning (see `aaos-api`'s `CAMPAIGN_INSIGHT_SYSTEM_PROMPT`
 * for the same note on the model side).
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

const TRIAGE_CONFIG: Readonly<
  Record<
    CampaignInsightTriageLevel,
    { readonly dot: string; readonly label: string; readonly pulse: boolean }
  >
> = {
  DARURAT: { dot: "#ef4444", label: "DARURAT", pulse: true },
  KRITIS: { dot: "#f59f00", label: "KRITIS", pulse: true },
  PERLU_PERHATIAN: { dot: "#d97706", label: "PERLU PERHATIAN", pulse: false },
  SEHAT: { dot: "#10b981", label: "SEHAT", pulse: false },
};

const BUDGET_RECOMMENDATION_CLASS: Readonly<Record<CampaignInsightBudgetRecommendation, string>> = {
  increase: styles.budgetRecommendedIncrease!,
  decrease: styles.budgetRecommendedDecrease!,
  pause: styles.budgetRecommendedPause!,
  maintain: styles.budgetRecommendedMaintain!,
};

const PLAYBOOK_PHASES = [
  { key: "immediate" as const, label: "Sekarang", suffix: "Immediate" },
  { key: "shortTerm" as const, label: "3-7 hari", suffix: "ShortTerm" },
  { key: "mediumTerm" as const, label: "2-4 minggu", suffix: "MediumTerm" },
];

const METRIC_STATUS_CLASS: Readonly<Record<string, string>> = {
  critical: styles.metricStatusCritical!,
  warning: styles.metricStatusWarning!,
  good: styles.metricStatusGood!,
  neutral: styles.metricStatusNeutral!,
};

/**
 * SAMANTHA ADVANCED SPRINT 2 — real per-ad breakdown for `CampaignInsightRequestDto.ads`, built
 * from the SAME `campaign.adSets` tree `CampaignAdDrillDown` already renders (never a second Meta
 * pull, never re-derived numbers) — the exact `rphChatIDR` ratio that component's own diagnosis
 * request already computes, shared via `campaignInsightMath.ts` so the two surfaces can never drift.
 */
function buildInsightAds(campaign: CampaignSummaryDto) {
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
 * AAOS-CAMPAIGNS-UNIFIED-PAGE — the unified page's click-to-expand insight panel.
 *
 * SAMANTHA ADVANCED INSIGHT ENGINE — full rewrite of the "Analisa Samantha" section from the
 * previous `diagnosis`/`metricEvidence`/`actions` shape (Campaign Page Rebuild v2) into a
 * senior-media-buyer diagnosis layout: triage header, root cause, "yang terjadi" story, metric
 * breakdown, a 3-phase playbook, a Kai directive (informational — the real "Brief Kai" ACTION
 * still lives on `AndromedaHealthCard` immediately below this panel, never duplicated here), a
 * budget decision, 2 scenarios, an optional competitor-context note, learnings, and an optional
 * pro tip. The KPI grid / CPL bar / ad drill-down below are unchanged from the previous rebuild.
 *
 * Real new request inputs this rewrite adds (see `aaos-api`'s `CampaignInsightRequestSchema` for
 * the full doc): `dailyBudget`/`cpc`/`cpm`/`reach` (already-aggregated, just not previously sent),
 * `spendTrend7d`/`resultsTrend7d`/`freqTrend7d` (the same real `history` this panel already
 * fetches for sparklines), `andromedaDiversity` (best-effort fetch of the SAME real
 * `andromeda-health` endpoint `AndromedaHealthCard` uses — reused, never re-scored), and
 * `hotLeadsCount` (best-effort fetch of `/api/leads`, grouped by the real `LeadDto.campaignId`
 * field, the same real attribution `ObjectiveStripCard.tsx`'s own breakdown uses).
 */
export function CampaignInsightPanel({
  campaign,
  benchmarkCplIDR,
  onClose,
}: CampaignInsightPanelProps): React.ReactElement {
  const [insight, setInsight] = useState<CampaignInsightResponseDto | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);
  const [marketDigest, setMarketDigest] = useState<string | null | undefined>(undefined);
  const [history, setHistory] = useState<readonly CampaignHistoryPointDto[] | undefined>(undefined);
  const [andromedaHealth, setAndromedaHealth] = useState<AndromedaHealthDto | undefined>(undefined);
  const [hotLeadsCount, setHotLeadsCount] = useState<number | undefined>(undefined);

  // Real bug fix (live-confirmed report, see `VerdictCards.tsx`'s own identical fix and doc): a
  // delayed/partial ad-level Meta Insights pull can leave `campaign.adSets` genuinely empty/zeroed
  // while the campaign-level Insights row (`campaign.spend`) already has the real number. Falling
  // back to the real `campaign.spend` gives the KPI display AND the LLM the real, non-zero spend
  // context it needs.
  const aggregate = aggregateCampaign(campaign);
  const adLevelSpendAvailable = aggregate.spend > 0;
  const displaySpend = adLevelSpendAvailable ? aggregate.spend : campaign.spend;
  const cpl = adLevelSpendAvailable ? computeCpl(aggregate.spend, aggregate.totalLead) : null;
  const ctr = ctrFromAggregate(aggregate);
  const cpc = cpcFromAggregate(aggregate);
  const cpm = cpmFromAggregate(aggregate);
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
        dailyBudget: aggregate.dailyBudget,
        cpc,
        cpm,
        reach: aggregate.reach,
        ads: buildInsightAds(campaign),
        learningAdSetStableIds: buildLearningAdSetStableIds(campaign),
        marketDigest,
        ctrTrend7d: history?.map((point) => point.ctr),
        spendTrend7d: history?.map((point) => point.spend),
        resultsTrend7d: history?.map((point) => point.leads),
        freqTrend7d: history?.map((point) => point.frequency),
        andromedaDiversity: andromedaHealth?.diversity,
        hotLeadsCount,
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
    // Re-fetch only when the selected campaign genuinely changes — every other value used above
    // (`marketDigest`/`history`/`andromedaHealth`/`hotLeadsCount`) is deliberately NOT a dependency:
    // this uses whichever value each best-effort fetch holds right now, never re-triggering a
    // second campaign-insight call when one of them resolves later.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id]);

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
  // (`meta_insights_daily` read-back) for sparklines/deltas AND the trend arrays fed to Samantha.
  // Campaign-scoped, keyed by the real, stable `metaId` (never `id`).
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
        // Best-effort only — sparklines/deltas/trend arrays just stay absent.
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.metaId]);

  // SAMANTHA ADVANCED INSIGHT ENGINE — real, best-effort fetch of the SAME `andromeda-health`
  // endpoint `AndromedaHealthCard` (rendered right below this panel) already uses, reused here
  // only to feed Samantha's prompt the real diversity signal — never a second scoring mechanism.
  useEffect(() => {
    let cancelled = false;
    setAndromedaHealth(undefined);
    fetch(`/api/campaigns/${encodeURIComponent(campaign.id)}/andromeda-health`)
      .then((res) => (res.ok ? (res.json() as Promise<AndromedaHealthDto>) : undefined))
      .then((body) => {
        if (!cancelled) {
          setAndromedaHealth(body);
        }
      })
      .catch(() => {
        // Best-effort only — `andromedaDiversity` just stays absent from the Samantha request.
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  // SAMANTHA ADVANCED INSIGHT ENGINE — real, best-effort HOT-lead count for this campaign, grouped
  // client-side from `/api/leads` by the real `LeadDto.campaignId` (the SAME real attribution
  // `ObjectiveStripCard.tsx`'s own per-campaign breakdown uses). `campaign.id` (not `metaId`) since
  // `LeadDto.campaignId` is populated by `aaos-api` from its own internal campaign id.
  useEffect(() => {
    let cancelled = false;
    setHotLeadsCount(undefined);
    fetch("/api/leads")
      .then((res) => (res.ok ? (res.json() as Promise<{ leads?: readonly LeadDto[] }>) : undefined))
      .then((body) => {
        if (cancelled || body?.leads === undefined) {
          return;
        }
        const count = body.leads.filter(
          (lead) => lead.temperature === "HOT" && lead.campaignId === campaign.id,
        ).length;
        setHotLeadsCount(count);
      })
      .catch(() => {
        // Best-effort only — `hotLeadsCount` just stays absent from the Samantha request.
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id]);

  const cplRatio =
    cpl !== null && benchmarkCplIDR !== null && benchmarkCplIDR > 0 ? cpl / benchmarkCplIDR : null;
  const triageConfig =
    insight?.available === true ? TRIAGE_CONFIG[insight.triage.level] : undefined;

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
        {triageConfig !== undefined ? (
          <>
            <div className={styles.triageDotWrap} data-testid="insight-triage">
              <span
                className={`${styles.triageDot} ${triageConfig.pulse ? styles.triageDotPulse : ""}`}
                style={{ background: triageConfig.dot }}
              />
              <div>
                <div
                  className={styles.triageLabel}
                  data-testid="insight-triage-label"
                  style={{ color: triageConfig.dot }}
                >
                  {triageConfig.label}
                </div>
                <div className={styles.triageSub}>
                  {insight?.available === true ? insight.triage.why : ""}
                </div>
              </div>
            </div>
            <div className={styles.triageDivider} />
          </>
        ) : (
          <div className={styles.verdictIcon} style={{ background: verdictConfig.border }}>
            {verdictConfig.icon}
          </div>
        )}
        <div className={styles.verdictBody}>
          <span
            className={styles.verdictBadge}
            data-testid="insight-verdict-badge"
            style={{ background: verdictConfig.border }}
          >
            {verdictConfig.label}
          </span>
          {!loading && insight?.available === true ? (
            <span className={styles.confidenceNote} data-testid="insight-confidence">
              {" "}
              {insight.confidence}% yakin
            </span>
          ) : null}
          {!loading && insight?.available === true ? (
            <p className={styles.diagnosis} data-testid="insight-verdict-oneliner">
              {insight.verdictOneLiner}
            </p>
          ) : null}
        </div>
        <div className={styles.samanthaAvatar}>S</div>
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
              {/* Section C — Root Cause */}
              <div className={styles.rootCauseBlock} data-testid="insight-root-cause">
                <p className={styles.blockLabel}>Root Cause Analysis</p>
                <div className={styles.rootCauseRow}>
                  <span className={styles.rootCauseIcon}>!</span>
                  <div>
                    <p className={styles.rootCausePrimary}>{insight.rootCause.primary}</p>
                    <p className={styles.rootCauseEvidence}>{insight.rootCause.primaryEvidence}</p>
                  </div>
                </div>
                {insight.rootCause.secondary !== undefined ? (
                  <p className={styles.rootCauseSecondary}>{insight.rootCause.secondary}</p>
                ) : null}
                {insight.rootCause.ruled_out !== undefined ? (
                  <p className={styles.rootCauseRuledOut} data-testid="insight-ruled-out">
                    <strong>Bukan karena:</strong> {insight.rootCause.ruled_out}
                  </p>
                ) : null}
              </div>

              {/* Section D — What Happened */}
              <div className={styles.whatHappenedBlock} data-testid="insight-what-happened">
                <p className={styles.whatHappenedLabel}>Yang Terjadi</p>
                <p className={styles.whatHappenedText}>&ldquo;{insight.whatHappened}&rdquo;</p>
              </div>

              {/* Section E — Metric Breakdown */}
              <ul className={styles.metricBreakdownList} data-testid="insight-metric-breakdown">
                {insight.metricBreakdown.map((entry, index) => (
                  <li key={index} className={styles.metricBreakdownItem}>
                    <div className={styles.metricBreakdownTop}>
                      <span
                        className={`${styles.metricBreakdownMetric} ${METRIC_STATUS_CLASS[entry.status] ?? ""}`}
                      >
                        {entry.metric}
                      </span>
                    </div>
                    <p className={styles.metricBreakdownInterpretation}>{entry.interpretation}</p>
                    <p className={styles.metricBreakdownContext}>{entry.vsContext}</p>
                    <p className={styles.metricBreakdownTrend}>
                      {entry.trend === "naik" ? "↑" : entry.trend === "turun" ? "↓" : "→"}{" "}
                      {entry.trendDetail}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Section F — Playbook */}
              <div className={styles.playbookBlock} data-testid="insight-playbook">
                <p className={styles.blockLabel}>Playbook — Apa yang harus dilakukan</p>
                {PLAYBOOK_PHASES.map((phase) => {
                  const step = insight.playbook[phase.key];
                  return (
                    <div
                      key={phase.key}
                      data-testid={`insight-playbook-${phase.key}`}
                      className={`${styles.playbookPhase} ${styles[`playbookPhase${phase.suffix}`]}`}
                    >
                      <div className={styles.playbookPhaseHeader}>
                        <span
                          className={`${styles.playbookBadge} ${styles[`playbookBadge${phase.suffix}`]}`}
                        >
                          {phase.label}
                        </span>
                        <span className={styles.playbookAction}>{step.action}</span>
                      </div>
                      <p className={styles.playbookHow}>{step.how}</p>
                      <div className={styles.playbookFooter}>
                        <span className={styles.playbookExpected}>✓ {step.expectedResult}</span>
                        {step.risk_if_not !== undefined ? (
                          <span className={styles.playbookRisk}>✗ {step.risk_if_not}</span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Section G — Kai Directive (informational; real action on AndromedaHealthCard below) */}
              {insight.kaiDirective.needed ? (
                <div className={styles.kaiBlock} data-testid="insight-kai-directive">
                  <div className={styles.kaiHeader}>
                    <div className={styles.kaiAvatar}>K</div>
                    <div>
                      <div className={styles.kaiTitle}>Samantha → Kai Directive</div>
                      <div className={styles.kaiUrgency}>
                        {insight.kaiDirective.urgency === "immediate"
                          ? "⚡ Segera"
                          : insight.kaiDirective.urgency === "this_week"
                            ? "📅 Minggu ini"
                            : insight.kaiDirective.urgency === "next_cycle"
                              ? "🔄 Cycle berikutnya"
                              : ""}
                      </div>
                    </div>
                  </div>
                  {insight.kaiDirective.brief !== undefined ? (
                    <div className={styles.kaiBriefBox}>
                      <p className={styles.kaiBriefLabel}>Brief untuk Kai:</p>
                      <p className={styles.kaiBriefText}>{insight.kaiDirective.brief}</p>
                    </div>
                  ) : null}
                  {insight.kaiDirective.angles_to_avoid !== undefined ? (
                    <p className={styles.kaiAvoid}>
                      ✗ Hindari: {insight.kaiDirective.angles_to_avoid}
                    </p>
                  ) : null}
                  <p className={styles.kaiActionNote}>
                    Gunakan tombol &ldquo;Brief Kai sekarang&rdquo; di kartu Andromeda Health di
                    bawah untuk membuat brief ini.
                  </p>
                </div>
              ) : null}

              {/* Section H — Budget Decision */}
              <div className={styles.budgetBlock} data-testid="insight-budget-decision">
                <div>
                  <p className={styles.blockLabel}>Keputusan Budget</p>
                  <div className={styles.budgetRow}>
                    <span className={styles.budgetCurrent}>
                      {formatIdr(insight.budgetDecision.currentBudget)}
                    </span>
                    <span
                      className={`${styles.budgetRecommended} ${BUDGET_RECOMMENDATION_CLASS[insight.budgetDecision.recommendation]}`}
                    >
                      {insight.budgetDecision.recommendation === "pause"
                        ? "PAUSE"
                        : formatIdr(insight.budgetDecision.recommendedBudget)}
                    </span>
                    {insight.budgetDecision.changePercent !== 0 ? (
                      <span
                        className={
                          insight.budgetDecision.changePercent > 0
                            ? styles.budgetChangePositive
                            : styles.budgetChangeNegative
                        }
                      >
                        {insight.budgetDecision.changePercent > 0 ? "+" : ""}
                        {insight.budgetDecision.changePercent}%
                      </span>
                    ) : null}
                  </div>
                  <p className={styles.budgetReasoning}>{insight.budgetDecision.reasoning}</p>
                </div>
                <div>
                  {insight.budgetDecision.prerequisite !== undefined ? (
                    <p className={styles.budgetPrerequisite}>
                      <strong>Syarat dulu:</strong> {insight.budgetDecision.prerequisite}
                    </p>
                  ) : null}
                  {insight.budgetDecision.opportunityCost !== undefined ? (
                    <p className={styles.budgetOpportunityCost}>
                      Opportunity cost: {insight.budgetDecision.opportunityCost}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Section I — Scenarios */}
              <div className={styles.scenarioBlock} data-testid="insight-scenarios">
                <p className={styles.blockLabel}>2 Skenario</p>
                <div className={styles.scenarioGrid}>
                  {insight.scenarios.map((scenario, index) => (
                    <div
                      key={index}
                      className={`${styles.scenarioCard} ${index === 0 ? styles.scenarioCardPrimary : ""}`}
                    >
                      <div className={styles.scenarioHeaderRow}>
                        <span
                          className={`${styles.scenarioName} ${index === 0 ? styles.scenarioNamePrimary : ""}`}
                        >
                          {scenario.name}
                        </span>
                        <span
                          className={`${styles.scenarioProbability} ${index === 0 ? styles.scenarioProbabilityPrimary : ""}`}
                        >
                          {scenario.probability}
                        </span>
                      </div>
                      <p className={styles.scenarioOutcome}>{scenario.expectedOutcome}</p>
                      <p className={styles.scenarioTime}>Waktu: {scenario.timeToResult}</p>
                      {scenario.risk !== undefined ? (
                        <p className={styles.scenarioRisk}>⚠ {scenario.risk}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {insight.competitorContext !== undefined ? (
                <p className={styles.contextNote} data-testid="insight-competitor-context">
                  {insight.competitorContext}
                </p>
              ) : null}

              {/* Section J — Pro Tip */}
              {insight.proTip !== undefined ? (
                <div className={styles.proTipBlock} data-testid="insight-pro-tip">
                  <p className={styles.proTipLabel}>💡 Pro Tip dari Samantha</p>
                  <p className={styles.proTipText}>{insight.proTip}</p>
                </div>
              ) : null}

              {/* Section K — Learnings */}
              {insight.learnings.length > 0 ? (
                <div className={styles.learningsBlock} data-testid="insight-learnings">
                  <p className={styles.learningsLabel}>Yang bisa dipelajari untuk campaign lain:</p>
                  {insight.learnings.map((learning, index) => (
                    <p key={index} className={styles.learningItem}>
                      → {learning}
                    </p>
                  ))}
                </div>
              ) : null}
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
