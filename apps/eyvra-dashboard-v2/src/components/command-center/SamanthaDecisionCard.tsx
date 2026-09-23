"use client";

import { useState } from "react";
import Link from "next/link";
import { Drawer as EvidenceDrawer } from "@/components/common/Drawer";
import { Sparkline, type SparklineTone } from "@/components/common/Sparkline";
import { getMetricDeltaIntent, presentLabel, presentText } from "@/lib/presentation";

import { stripAdNameSuffix } from "@/lib/verdict";
import { formatIdrCompact, formatNumber } from "@/lib/formatters";
import type {
  CampaignHealthSummaryEntryDto,
  HealthStatus,
  SamanthaSignalDto,
} from "@/types/dashboard.types";
import styles from "./SamanthaDecisionQueue.module.css";
import { useCampaignThumbnail } from "./useCampaignThumbnail";

const ROOT_CAUSE_LABEL: Record<string, string> = {
  CREATIVE_FATIGUE: "Creative Fatigue",
  CTR_DROP: "CTR Menurun",
  CTR_IMPROVEMENT: "CTR Membaik",
  CPL_SPIKE: "CPL Melonjak",
  CPL_IMPROVEMENT: "CPL Membaik",
  FREQUENCY_RISE: "Frekuensi Naik",
  SPEND_WITHOUT_RESULT: "Spend Tanpa Hasil",
  INSUFFICIENT_DATA: "Data Tidak Cukup",
};

const IMPACT_TONE: Record<string, string> = {
  CRITICAL: "critical",
  HIGH: "warning",
  MEDIUM: "warning",
  LOW: "success",
  UNKNOWN: "neutral",
};

const HEALTH_DIMENSION_ORDER = [
  "delivery",
  "costEfficiency",
  "creative",
  "audience",
  "conversion",
  "tracking",
  "leadQuality",
] as const;

const HEALTH_DIMENSION_LABEL: Record<(typeof HEALTH_DIMENSION_ORDER)[number], string> = {
  delivery: "Delivery",
  costEfficiency: "Cost Eff.",
  creative: "Creative",
  audience: "Audience",
  conversion: "Conversion",
  tracking: "Tracking",
  leadQuality: "Lead Quality",
};

/**
 * Real metric acronyms stay upper-case (`CTR`, not `Ctr`) — the same discipline
 * `lib/presentation.ts`'s own `ACRONYMS` set enforces for reasoning strings, applied here to the
 * lower-case metric keys the real `SamanthaSignal.metric` field carries.
 */
const METRIC_LABEL: Record<string, string> = {
  ctr: "CTR",
  cpl: "CPL",
  cpql: "CPQL",
  cpc: "CPC",
  cpm: "CPM",
  frequency: "Frequency",
  leads: "Leads",
  spend: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
};

function metricLabel(metric: string | undefined): string {
  if (metric === undefined) return "Metric";
  return (
    METRIC_LABEL[metric] ?? metric.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatMetricValue(metric: string | undefined, value: number | undefined): string {
  if (value === undefined) return "—";
  switch (metric) {
    case "ctr":
      return `${(value * 100).toFixed(2)}%`;
    case "cpl":
      return formatIdrCompact(value);
    case "frequency":
      return value.toFixed(2);
    case "leads":
      return formatNumber(value);
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
}

function healthDimensionTitle(
  label: string,
  status: HealthStatus,
  score: number | undefined,
  confidence: number,
): string {
  if (status === "UNKNOWN") {
    return `${label}: belum ada data yang cukup (data sufficiency signal ini sendiri).`;
  }
  const scorePart = score !== undefined ? `score ${String(score)}/100` : "";
  return `${label}: ${presentLabel(status)}${scorePart !== "" ? ` · ${scorePart}` : ""} · confidence ${String(Math.round(confidence * 100))}%`;
}

/** Real `SamanthaSignalSeverity` ordering — used only to pick WHICH real evidence entry's own `reasoning` becomes the row's sub-line. */
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 5, HIGH: 4, MEDIUM: 3, LOW: 2, INFO: 1 };

/**
 * The row's grey descriptive sub-line, taken VERBATIM from the highest-severity real evidence
 * entry's own `reasoning` string — the sentence the real signal engine
 * (`modules/metric-snapshot/domain/signal-engine.ts`) actually wrote, e.g. "CTR turun 50% dibanding
 * periode sebelumnya — penurunan signifikan (ambang 30%)". Nothing here composes a new sentence out
 * of numbers; ties keep the first (already highest-confidence-ordered) entry.
 *
 * `undefined` when this campaign genuinely has no evidence, in which case the caller falls back to
 * the existing human-readable root-cause label.
 */
function subLineFromEvidence(evidence: readonly SamanthaSignalDto[]): string | undefined {
  let best: SamanthaSignalDto | undefined;
  for (const signal of evidence) {
    if (
      best === undefined ||
      (SEVERITY_RANK[signal.severity] ?? 0) > (SEVERITY_RANK[best.severity] ?? 0)
    ) {
      best = signal;
    }
  }
  if (best === undefined || best.reasoning.length === 0) {
    return undefined;
  }
  return presentText(best.reasoning);
}

/**
 * The row's `Samantha Plan` lines — up to 2 REAL strings, in this priority:
 *   1. `decision.monitoringPlan.successConditions` (real Indonesian strings written by
 *      `decideNextAction`'s own monitoring plan), which are the closest real equivalent of the
 *      reference mockup's two short plan lines.
 *   2. `decision.reason` (a real string) when this decision carries no success conditions.
 *
 * Deliberately NOT invented action phrasing: no field in this codebase says anything like
 * "Generate 6 new creatives", so that reference wording is not reproduced. Each line is ellipsised
 * in CSS with the full real text in the element's `title`.
 */
function planLines(entry: CampaignHealthSummaryEntryDto): readonly string[] {
  const { decision } = entry;
  const conditions = decision.monitoringPlan.successConditions.filter((line) => line.length > 0);
  if (conditions.length > 0) {
    return conditions.slice(0, 2).map((line) => presentText(line));
  }
  return decision.reason.length > 0 ? [presentText(decision.reason)] : [];
}

/**
 * Sparkline tone from the REAL series' own first -> last direction, run through the same
 * metric-aware `getMetricDeltaIntent` the metric deltas use — so a rising CPL line is red and a
 * rising CTR line is green, never coloured by arithmetic sign alone.
 */
function sparklineTone(metric: string, points: readonly number[]): SparklineTone {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined || first === 0) {
    return "neutral";
  }
  const intent = getMetricDeltaIntent(metric, (last - first) / Math.abs(first));
  return intent === "good" ? "up" : intent === "bad" ? "down" : "neutral";
}

export function SamanthaDecisionCard({
  entry,
}: {
  readonly entry: CampaignHealthSummaryEntryDto;
}): React.ReactElement {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const { diagnosis, decision, health } = entry;
  const name = stripAdNameSuffix(entry.campaignName);
  const rootCauseKey = diagnosis.rootCause ?? "INSUFFICIENT_DATA";
  const rootCauseLabel = ROOT_CAUSE_LABEL[rootCauseKey] ?? presentLabel(rootCauseKey);
  const impactTone = IMPACT_TONE[decision.impact] ?? "neutral";
  const confidencePct = Math.round(decision.confidence * 100);
  const topEvidence = diagnosis.evidence.slice(0, 2);
  const subLine = subLineFromEvidence(diagnosis.evidence) ?? rootCauseLabel;
  const plan = planLines(entry);
  /**
   * Real per-campaign daily series for this row's mini sparkline (`trend`), computed server-side
   * inside the SAME already-cached `account-summary` payload this row renders from — a
   * `meta_insights_daily` (Postgres) read, so it adds ZERO Meta Ads API calls and cannot delay this
   * row. Genuinely `undefined` (no sparkline at all, never a flat placeholder line) when the
   * campaign has <2 real days, its real root cause maps to none of the 3 charted series, or the
   * real history read failed — `Sparkline` itself also renders nothing below 2 points.
   */
  const trend = entry.trend;
  /**
   * Real property photo for this row, resolved best-effort over the real
   * campaign -> `listings.id` -> `mainPhotoUrl` chain (see `useCampaignThumbnail`). Never blocks
   * this row's own render, and stays `undefined` — honest placeholder tile below — whenever the
   * campaign has no linked listing, the listing has no photos, or either real lookup fails.
   *
   * This is now PRIORITY 5 (the listing fallback): the real Meta creative thumbnail below takes
   * precedence whenever the account summary resolved one.
   */
  const thumbnail = useCampaignThumbnail(entry.campaignId);
  /**
   * PRIORITY 1-4 — the real Meta creative representing this campaign, already selected and resolved
   * server-side (`representativeCreative`, `GET /api/v1/command-center/account-summary`). No extra
   * fetch here: it arrives with the summary this row already rendered from, so it costs zero
   * additional Meta calls and can never delay the row.
   *
   * A real Meta CDN URL can still fail in the browser (Meta's `url` expires), so a load failure
   * falls through to the listing photo and then the placeholder — the same honest degrade
   * `useCampaignThumbnail.onImageError` already implements for the listing photo.
   */
  const creative = entry.representativeCreative;
  const [metaThumbnailFailed, setMetaThumbnailFailed] = useState(false);
  const metaThumbnailUrl =
    !metaThumbnailFailed && creative?.thumbnailUrl !== undefined && creative.thumbnailUrl.length > 0
      ? creative.thumbnailUrl
      : undefined;
  const thumbnailUrl = metaThumbnailUrl ?? thumbnail.url;
  const thumbnailIsMetaCreative = metaThumbnailUrl !== undefined;
  const badgeTone = creative?.badge === "WINNER" ? "winner" : "fatigued";

  return (
    <li
      className={`${styles.row} ${styles[`rail_${impactTone}`]}`}
      data-testid={`decision-card-${entry.campaignId}`}
    >
      <div className={styles.rowMain}>
        <div className={styles.thumbnailBox}>
          {thumbnailUrl !== undefined ? (
            // eslint-disable-next-line @next/next/no-img-element -- trusted backend asset URL, no image proxy configuration required.
            <img
              className={styles.thumbnailImage}
              src={thumbnailUrl}
              alt={
                thumbnailIsMetaCreative
                  ? `Creative Meta ${creative?.kind === "VIDEO" ? "(thumbnail video)" : "(gambar)"} untuk ${name}`
                  : `Foto properti untuk ${name}`
              }
              title={
                thumbnailIsMetaCreative
                  ? `Creative Meta yang mewakili campaign ini (ad ${creative?.metaAdId ?? ""}, ref ${creative?.metaCreativeRef ?? ""}).`
                  : undefined
              }
              loading="lazy"
              onError={
                thumbnailIsMetaCreative
                  ? () => setMetaThumbnailFailed(true)
                  : thumbnail.onImageError
              }
              data-testid={`decision-thumbnail-${entry.campaignId}`}
              data-source={thumbnailIsMetaCreative ? "META_CREATIVE" : "LISTING"}
            />
          ) : (
            <div
              className={styles.thumbnail}
              title="Belum ada foto: campaign ini belum punya creative Meta yang bisa di-resolve, dan belum tertaut ke listing mana pun."
              aria-label="Foto properti belum tersedia"
              data-testid={`decision-thumbnail-placeholder-${entry.campaignId}`}
            >
              {/* Intentional "no photo yet" tile, not a broken-image glyph — this campaign genuinely
                  has neither a resolvable Meta creative nor a linked listing, so there is no real
                  photo to show. */}
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M4 5.5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="9" cy="10.5" r="1.6" fill="currentColor" />
                <path
                  d="M5 17l4.2-4.2 3 3 2.6-2.4L19 17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
          {/* Real condition of the creative representing this campaign — `WINNER` from a real
              A/B-test winner or Samantha's SCALE verdict, `FATIGUED` from her REFRESH verdict.
              Rendered only when the backend actually established one. */}
          {creative?.badge !== undefined ? (
            <span
              className={`${styles.creativeBadge} ${styles[`badge_${badgeTone}`]}`}
              title={
                creative.badge === "WINNER"
                  ? "Creative ini menang: winner A/B test nyata, atau verdict SCALE dari Samantha."
                  : "Creative ini lelah (creative fatigue): verdict REFRESH dari Samantha."
              }
              data-testid={`decision-creative-badge-${entry.campaignId}`}
            >
              {creative.badge === "WINNER" ? "WINNER" : "FATIGUED"}
            </span>
          ) : null}
        </div>
        <div className={styles.rowIdentity}>
          <span className={`${styles.impactBadge} ${styles[`impact_${impactTone}`]}`}>
            <span className={styles.impactDot} aria-hidden="true" />
            {presentLabel(decision.impact)} Impact
          </span>
          <p className={styles.rowName}>
            <Link href={`/campaigns/${entry.campaignId}`}>{name}</Link>
          </p>
          {/* Real text only: the highest-severity real evidence `reasoning`, else the real
              root-cause label. Ellipsised here, full real string in `title`. */}
          <p
            className={styles.rowIssue}
            title={subLine}
            data-testid={`decision-subline-${entry.campaignId}`}
          >
            {subLine}
          </p>
        </div>

        {/* Real per-row mini sparkline, or nothing at all. The empty cell is deliberate: it keeps
            every row's column grid aligned without drawing a line this campaign has no data for. */}
        <div className={styles.rowSpark}>
          {trend !== undefined ? (
            <span
              className={styles.rowSparkInner}
              title={`Tren ${metricLabel(trend.metric)} harian nyata (${String(trend.points.length)} hari terakhir, meta_insights_daily).`}
              data-testid={`decision-sparkline-${entry.campaignId}`}
              data-metric={trend.metric}
              data-points={String(trend.points.length)}
            >
              <Sparkline
                points={trend.points}
                tone={sparklineTone(trend.metric, trend.points)}
                ariaLabel={`Tren ${metricLabel(trend.metric)} harian untuk ${name}`}
              />
            </span>
          ) : null}
        </div>

        {topEvidence.length > 0 ? (
          <div className={styles.rowMetrics}>
            {topEvidence.map((signal, index) => (
              <span key={`${signal.type}-${String(index)}`} className={styles.rowMetric}>
                <span className={styles.rowMetricLabel}>{metricLabel(signal.metric)}</span>
                <span className={styles.rowMetricValue}>
                  {formatMetricValue(signal.metric, signal.baselineValue)} →{" "}
                  {formatMetricValue(signal.metric, signal.currentValue)}
                </span>
                {signal.deltaPct !== undefined ? (
                  <span
                    className={`${styles.rowMetricDelta} ${
                      getMetricDeltaIntent(signal.metric, signal.deltaPct) === "good"
                        ? styles.deltaGood
                        : getMetricDeltaIntent(signal.metric, signal.deltaPct) === "bad"
                          ? styles.deltaBad
                          : ""
                    }`}
                  >
                    {signal.deltaPct > 0 ? "↑" : "↓"}
                    {Math.abs(Math.round(signal.deltaPct * 100))}%
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.rowNoEvidence}>Belum ada sinyal metrik nyata.</p>
        )}

        <span
          className={styles.rowConfidence}
          data-testid={`decision-confidence-${entry.campaignId}`}
        >
          <small>Confidence</small>
          <strong>{confidencePct}%</strong>
        </span>

        <div className={styles.rowPlanSummary}>
          <small>Samantha Plan</small>
          {plan.length > 0 ? (
            plan.map((line, index) => (
              <span key={index} className={styles.rowPlanLine} title={line}>
                {line}
              </span>
            ))
          ) : (
            <span className={styles.rowPlanLine}>Belum ada rencana tertulis.</span>
          )}
        </div>

        <div className={styles.rowActions}>
          {/* Styled per the reference (solid brand purple) but GENUINELY non-functional: there is no
              plan-approval/execution endpoint anywhere in this codebase, so this is rendered
              `disabled` with an honest tooltip. Never a purple button that looks clickable and
              silently does nothing, and never a faked success path. */}
          <button
            type="button"
            className={styles.approveButton}
            disabled
            title="Approve Plan belum aktif: belum ada endpoint eksekusi rencana di backend, jadi tombol ini sengaja dimatikan daripada berpura-pura berhasil."
            data-testid={`decision-approve-${entry.campaignId}`}
          >
            Approve Plan
          </button>
          <button
            type="button"
            className={styles.evidenceButton}
            onClick={() => setEvidenceOpen((value) => !value)}
            aria-expanded={evidenceOpen}
          >
            View Evidence
          </button>
          {/* Overflow affordance from the reference. Also genuinely non-functional: no additional
              real per-row action exists yet, so it is disabled with an honest tooltip rather than
              opening an empty menu. */}
          <button
            type="button"
            className={styles.overflowButton}
            disabled
            aria-label="Aksi lain"
            title="Belum ada aksi baris lain yang nyata di backend."
            data-testid={`decision-overflow-${entry.campaignId}`}
          >
            ⋮
          </button>
        </div>
      </div>

      <EvidenceDrawer
        open={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        title={`Evidence · ${name}`}
      >
        <div className={styles.evidenceDetail}>
          <h3>{rootCauseLabel}</h3>
          <p>Confidence: {confidencePct}%</p>
          <h3>Data sufficiency & creative health</h3>

          <div className={styles.healthRow} data-testid={`decision-health-${entry.campaignId}`}>
            {HEALTH_DIMENSION_ORDER.map((dimensionName) => {
              const dimension = health[dimensionName];
              const label = HEALTH_DIMENSION_LABEL[dimensionName];
              return (
                <span
                  key={dimensionName}
                  className={styles.healthDim}
                  title={healthDimensionTitle(
                    label,
                    dimension.status,
                    dimension.score,
                    dimension.confidence,
                  )}
                  data-testid={`decision-health-${entry.campaignId}-${dimensionName}`}
                  data-status={dimension.status}
                >
                  <span
                    className={`${styles.healthDot} ${styles[`health_${dimension.status}`] ?? ""}`}
                    aria-hidden="true"
                  />
                  {label}
                </span>
              );
            })}
          </div>

          <div className={styles.planBox}>
            <p className={styles.planLabel}>Samantha Plan</p>
            <p className={styles.planReason}>{presentText(decision.reason)}</p>
            {decision.monitoringPlan.successConditions.length > 0 ? (
              <ul className={styles.planList}>
                {decision.monitoringPlan.successConditions.map((condition, index) => (
                  <li key={index}>{presentText(condition)}</li>
                ))}
              </ul>
            ) : null}
            <p className={styles.planReview}>
              Review ulang dalam {decision.monitoringPlan.reviewAfterHours} jam.
            </p>
          </div>

          {diagnosis.evidence.length > 0 ? (
            <div className={styles.evidenceReasoningList}>
              {diagnosis.evidence.map((signal, index) => (
                <p key={index} className={styles.evidenceReasoning}>
                  <strong>{presentLabel(signal.type)}</strong> (
                  {Math.round(signal.confidence * 100)}%): {presentText(signal.reasoning)}
                </p>
              ))}
            </div>
          ) : null}
          <h3>Historical baseline & current metrics</h3>
          {diagnosis.evidence.map((signal, index) => (
            <p key={index}>
              {metricLabel(signal.metric)}: {formatMetricValue(signal.metric, signal.baselineValue)}{" "}
              → {formatMetricValue(signal.metric, signal.currentValue)}
            </p>
          ))}
          <h3>Expected outcome</h3>
          <p>{presentText(decision.expectedOutcome)}</p>
          <h3>Risk of waiting</h3>
          <p>{presentText(decision.riskOfDoingNothing)}</p>
          <h3>Contradicting evidence</h3>
          <p>Not provided by the current assessment.</p>
          <h3>Recent actions</h3>
          <p>Campaign-linked action history unavailable.</p>
          <h3>Lead quality</h3>
          <p>{presentLabel(health.leadQuality.status)}</p>
          <p>Spend: {formatIdrCompact(entry.spend)}</p>
        </div>
      </EvidenceDrawer>
    </li>
  );
}
