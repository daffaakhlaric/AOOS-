"use client";

import { useCallback, useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type {
  AssessmentComparisonResponseDto,
  CampaignHealthResponseDto,
  DimensionTrendDto,
  HealthDimensionDto,
  HealthStatusDto,
  RootCauseTrendDto,
} from "@/types/campaign-health.types";
import type { DiverseCreativeBriefSetResultDto } from "@/types/andromeda-health.types";

import styles from "./CampaignHealthCard.module.css";

export interface CampaignHealthCardProps {
  readonly campaignId: string;
  readonly campaignName: string;
  /**
   * The real, tenant-scoped `listings.id` this campaign maps to, when the caller can honestly
   * resolve one — mirrors `AndromedaHealthCard`'s own `listingId` prop doc EXACTLY:
   * `creative_packages` (and therefore "Brief Kai Sekarang") is listing-scoped, not
   * campaign-scoped. `undefined` for a campaign with no real Campaign->Listing Mapping link yet —
   * the Brief Kai button below is then honestly disabled with an explanation, never hidden or
   * fabricated as clickable.
   */
  readonly listingId?: string;
}

const DIMENSION_LABELS: Record<
  keyof Omit<CampaignHealthResponseDto["health"], "overallStatus">,
  string
> = {
  delivery: "Delivery",
  costEfficiency: "Efisiensi Biaya",
  creative: "Creative",
  audience: "Audience",
  conversion: "Conversion",
  tracking: "Tracking",
  leadQuality: "Kualitas Lead",
};

const DIMENSION_ORDER = Object.keys(DIMENSION_LABELS) as (keyof typeof DIMENSION_LABELS)[];

const STATUS_LABELS: Record<HealthStatusDto, string> = {
  HEALTHY: "Sehat",
  WATCH: "Pantau",
  WARNING: "Waspada",
  CRITICAL: "Kritis",
  UNKNOWN: "Belum Diketahui",
};

function statusBadgeClass(status: HealthStatusDto): string {
  switch (status) {
    case "HEALTHY":
      return styles.badgeHealthy ?? "";
    case "WATCH":
      return styles.badgeWatch ?? "";
    case "WARNING":
      return styles.badgeWarning ?? "";
    case "CRITICAL":
      return styles.badgeCritical ?? "";
    case "UNKNOWN":
      return styles.badgeUnknown ?? "";
  }
}

/** Real, honest Indonesian labels for the real `RecommendedActionType` values this codebase actually produces (`NO_ACTION`/`MONITOR`/`REQUEST_KAI_CREATIVE` plus the real `Verdict` enum `SCALE`/`KEEP`/`REVIEW`/`REFRESH`/`FIX`/`PAUSE`) — see `decision.ts`'s own doc for the full taxonomy. Never invented beyond these. */
const DECISION_LABELS: Record<string, string> = {
  NO_ACTION: "Tidak Ada Tindakan",
  MONITOR: "Pantau Terus",
  REQUEST_KAI_CREATIVE: "Minta Creative Baru ke Kai",
  SCALE: "Scale Up",
  KEEP: "Pertahankan",
  REVIEW: "Perlu Ditinjau",
  REFRESH: "Refresh Creative",
  FIX: "Perbaiki",
  PAUSE: "Hentikan (Pause)",
};

const TREND_LABELS: Record<DimensionTrendDto, string> = {
  IMPROVED: "Membaik",
  WORSENED: "Memburuk",
  UNCHANGED: "Tetap",
  NEWLY_KNOWN: "Baru Diketahui",
  NEWLY_UNKNOWN: "Jadi Tidak Diketahui",
};

const TREND_ARROWS: Record<DimensionTrendDto, string> = {
  IMPROVED: "↑",
  WORSENED: "↓",
  UNCHANGED: "→",
  NEWLY_KNOWN: "＋",
  NEWLY_UNKNOWN: "？",
};

const ROOT_CAUSE_TREND_LABELS: Record<RootCauseTrendDto, string> = {
  RESOLVED: "Root Cause Teratasi",
  PERSISTED: "Root Cause Masih Sama",
  NEW: "Root Cause Baru",
  NONE_EITHER_TIME: "Tidak Ada Root Cause (Sebelum & Sesudah)",
  CHANGED: "Root Cause Berubah",
};

function trendBadgeClass(trend: DimensionTrendDto): string {
  switch (trend) {
    case "IMPROVED":
      return styles.trendImproved ?? "";
    case "WORSENED":
      return styles.trendWorsened ?? "";
    case "UNCHANGED":
      return styles.trendUnchanged ?? "";
    case "NEWLY_KNOWN":
      return styles.trendNewlyKnown ?? "";
    case "NEWLY_UNKNOWN":
      return styles.trendNewlyUnknown ?? "";
  }
}

function TrendBadge({
  trend,
  testId,
}: {
  readonly trend: DimensionTrendDto;
  readonly testId: string;
}): React.ReactElement {
  return (
    <span data-testid={testId} className={`${styles.trendBadge} ${trendBadgeClass(trend)}`}>
      {TREND_ARROWS[trend]} {TREND_LABELS[trend]}
    </span>
  );
}

function StatusBadge({
  status,
  testId,
}: {
  readonly status: HealthStatusDto;
  readonly testId: string;
}): React.ReactElement {
  return (
    <span data-testid={testId} className={`${styles.badge} ${statusBadgeClass(status)}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function DimensionRow({
  name,
  dimension,
  trend,
}: {
  readonly name: string;
  readonly dimension: HealthDimensionDto;
  readonly trend?: DimensionTrendDto;
}): React.ReactElement {
  return (
    <div data-testid="health-dimension-row" className={styles.dimensionRow}>
      <div className={styles.dimensionHeader}>
        <span className={styles.dimensionLabel}>{name}</span>
        <div className={styles.dimensionBadges}>
          <StatusBadge status={dimension.status} testId="dimension-status-badge" />
          {trend !== undefined ? <TrendBadge trend={trend} testId="dimension-trend-badge" /> : null}
        </div>
      </div>
      {dimension.issues.length > 0 ? (
        <ul className={styles.issueList}>
          {dimension.issues.map((issue, index) => (
            <li key={`${issue}-${String(index)}`} className={styles.issueText}>
              {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Phase 18 — renders the real, backend-computed `AssessmentComparisonResponseDto`. `available:
 * false` is an honest, expected state (fewer than 2 recorded assessments exist yet for this
 * campaign) — the real `reason` string the backend wrote is shown directly, never paraphrased.
 * `undefined` (fetch still pending, or the best-effort fetch failed) renders nothing at all —
 * this section is purely additive and must never be mistaken for an error on the main card.
 */
function TrendSection({
  trend,
}: {
  readonly trend: AssessmentComparisonResponseDto | undefined;
}): React.ReactElement | null {
  if (trend === undefined) {
    return null;
  }

  if (!trend.available) {
    return (
      <div data-testid="assessment-trend-section" className={styles.trendBox}>
        <h4 className={styles.subTitle}>Trend Assessment</h4>
        <p data-testid="trend-unavailable-reason" className={styles.trendUnavailable}>
          {trend.reason}
        </p>
      </div>
    );
  }

  const { comparison } = trend;

  return (
    <div data-testid="assessment-trend-section" className={styles.trendBox}>
      <h4 className={styles.subTitle}>Trend Assessment</h4>
      <p data-testid="trend-summary" className={styles.trendSummary}>
        {comparison.summary}
      </p>
      <div className={styles.trendMetaRow}>
        <span data-testid="trend-overall-status" className={styles.trendMetaItem}>
          <span className={styles.diagnosisLabel}>Overall Status: </span>
          <TrendBadge trend={comparison.overallStatusTrend} testId="trend-overall-status-badge" />
        </span>
        <span data-testid="trend-root-cause" className={styles.trendMetaItem}>
          <span className={styles.diagnosisLabel}>Root Cause: </span>
          {ROOT_CAUSE_TREND_LABELS[comparison.rootCauseTrend]}
        </span>
        <span data-testid="trend-decision-changed" className={styles.trendMetaItem}>
          <span className={styles.diagnosisLabel}>Rekomendasi: </span>
          {comparison.decisionChanged ? "Rekomendasi berubah" : "Rekomendasi tidak berubah"}
        </span>
      </div>
    </div>
  );
}

/**
 * `CampaignHealthCard` (EYVRA — SAMANTHA V2 Phase 14) — real per-campaign multi-dimension
 * `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` (Phase 3/4's pure, deterministic
 * assessment engine — no LLM call), surfaced VISUALLY for the first time. Previously this same
 * real data was only computed silently to feed Phase 12's `CampaignInsightPanel` LLM prompt
 * (`GET /api/campaign-health/:campaignId`, already existing since Phase 12) — never rendered to
 * the user. This card reuses that exact same existing proxy route, no new backend surface.
 *
 * Phase 19 — when Samantha's own deterministic `decision.decision` is `REQUEST_KAI_CREATIVE`, this
 * card's decision section shows a real "Brief Kai Sekarang" button that triggers the EXACT SAME
 * real `POST /api/creative-packages/diverse-set` action `AndromedaHealthCard.tsx`'s own
 * `handleBriefKai` does (same body shape, same `briefing`/`briefResult`/`briefError` state
 * pattern, same honest disabled-when-`listingId===undefined` fallback) — a second, decision-driven
 * trigger for the same real backend action, not a second creative-brief mechanism.
 *
 * PLACEMENT: rendered by `CampaignsHubClient` right BEFORE `OpportunitiesCard` — health/diagnosis
 * (what's wrong, why, what Samantha recommends) logically precedes "what opportunities exist" in
 * the narrative, and `OpportunitiesCard`'s own `SCALING_OPPORTUNITY` detector is itself derived
 * from this same Health/Decision data (see `OpportunitiesCard`'s own doc), so showing the health
 * assessment first gives the opportunity card's evidence context the reader already has.
 */
export function CampaignHealthCard({
  campaignId,
  campaignName,
  listingId,
}: CampaignHealthCardProps): React.ReactElement {
  const [data, setData] = useState<CampaignHealthResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  // Phase 19 — the real "Brief Kai Sekarang" action, triggered from Samantha's own
  // `REQUEST_KAI_CREATIVE` decision (rather than `AndromedaHealthCard`'s diversity-status check).
  // Same real endpoint/body shape as `AndromedaHealthCard.tsx`'s own `handleBriefKai` — reused
  // as-is, not a second creative-brief mechanism.
  const [briefing, setBriefing] = useState(false);
  const [briefResult, setBriefResult] = useState<DiverseCreativeBriefSetResultDto | undefined>(
    undefined,
  );
  const [briefError, setBriefError] = useState<string | undefined>(undefined);

  // Phase 18 — real, independent best-effort fetch of the trend/comparison data (mirrors
  // `CampaignInsightPanel.tsx`'s/`GrowthObjectiveDetailClient.tsx`'s own established
  // "independent best-effort fetch, honest absence on failure" pattern): never blocks the
  // health/diagnosis/decision render above, and a genuine fetch failure just leaves `trend`
  // `undefined` (the section renders nothing rather than crashing the whole card).
  const [trend, setTrend] = useState<AssessmentComparisonResponseDto | undefined>(undefined);

  // Phase 18 — the real "Rekam Assessment Ini" action (`POST .../assess`), its own loading/error
  // state, independent of the main `data`/`error` pair above.
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | undefined>(undefined);

  const loadTrend = useCallback(() => {
    setTrend(undefined);
    fetch(`/api/campaign-health/${encodeURIComponent(campaignId)}/compare-latest`)
      .then((res) =>
        res.ok ? (res.json() as Promise<AssessmentComparisonResponseDto>) : undefined,
      )
      .then((body) => {
        setTrend(body);
      })
      .catch(() => {
        // Best-effort only — the Trend section just shows its honest-absent state.
      });
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    setBriefResult(undefined);
    setBriefError(undefined);
    fetch(`/api/campaign-health/${encodeURIComponent(campaignId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Campaign Health.");
        }
        const body = (await res.json()) as Partial<CampaignHealthResponseDto>;
        // Defensive, honest shape check — a malformed/unexpected response body must degrade to
        // the real error state below, never crash the whole `/campaigns` page render tree. Same
        // discipline `OpportunitiesCard`'s own `Array.isArray(body.opportunities)` check follows.
        if (
          body.health === undefined ||
          body.diagnosis === undefined ||
          body.decision === undefined
        ) {
          throw new Error("Respons Campaign Health tidak lengkap.");
        }
        return body as CampaignHealthResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Campaign Health.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  async function runAssess(): Promise<void> {
    setAssessing(true);
    setAssessError(undefined);
    try {
      const response = await fetch(
        `/api/campaign-health/${encodeURIComponent(campaignId)}/assess`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error("Gagal merekam assessment.");
      }
      const updated = (await response.json()) as CampaignHealthResponseDto;
      setData(updated);
      setError(undefined);
      loadTrend();
    } catch (caught) {
      setAssessError(caught instanceof Error ? caught.message : "Gagal merekam assessment.");
    } finally {
      setAssessing(false);
    }
  }

  function handleBriefKai(): void {
    if (listingId === undefined) return;
    setBriefing(true);
    setBriefError(undefined);
    setBriefResult(undefined);
    fetch("/api/creative-packages/diverse-set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId, campaignId, requestedCount: 5 }),
    })
      .then(async (res) => {
        const body = (await res.json()) as
          DiverseCreativeBriefSetResultDto | { readonly error: { readonly message: string } };
        if (!res.ok || "error" in body) {
          throw new Error("error" in body ? body.error.message : "Gagal membuat brief.");
        }
        return body;
      })
      .then((body) => setBriefResult(body))
      .catch((caught: unknown) => {
        setBriefError(caught instanceof Error ? caught.message : "Gagal membuat brief.");
      })
      .finally(() => setBriefing(false));
  }

  if (error !== undefined) {
    return (
      <section data-testid="campaign-health-card" className={styles.section}>
        <h3 className={styles.title}>Campaign Health — {campaignName}</h3>
        <p className={styles.errorBox}>{error}</p>
      </section>
    );
  }

  if (data === undefined) {
    return (
      <section data-testid="campaign-health-card" className={styles.section}>
        <h3 className={styles.title}>Campaign Health — {campaignName}</h3>
        <LoadingSpinner />
      </section>
    );
  }

  const { health, diagnosis, decision } = data;
  const decisionLabel = DECISION_LABELS[decision.decision] ?? decision.decision;
  const dimensionTrends = trend?.available === true ? trend.comparison.dimensionTrends : undefined;

  return (
    <section data-testid="campaign-health-card" className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Campaign Health — {campaignName}</h3>
        <StatusBadge status={health.overallStatus} testId="overall-status-badge" />
      </div>

      <div className={styles.dimensionGrid}>
        {DIMENSION_ORDER.map((name) => (
          <DimensionRow
            key={name}
            name={DIMENSION_LABELS[name]}
            dimension={health[name]}
            trend={dimensionTrends?.[name]}
          />
        ))}
      </div>

      <div data-testid="diagnosis-summary" className={styles.diagnosisBox}>
        <h4 className={styles.subTitle}>Diagnosis</h4>
        <p className={styles.diagnosisLine}>
          <span className={styles.diagnosisLabel}>Root Cause: </span>
          {diagnosis.rootCause ?? "Tidak ada root cause terdeteksi"}
        </p>
        <p className={styles.diagnosisLine}>
          <span className={styles.diagnosisLabel}>Confidence: </span>
          {Math.round(diagnosis.confidence * 100)}%
        </p>
        <p className={styles.diagnosisLine}>
          <span className={styles.diagnosisLabel}>Impact: </span>
          {diagnosis.impact}
        </p>
      </div>

      <div data-testid="decision-summary" className={styles.decisionBox}>
        <h4 className={styles.subTitle}>Rekomendasi Samantha</h4>
        <p className={styles.decisionAction}>{decisionLabel}</p>
        <p className={styles.decisionReason}>{decision.reason}</p>

        {decision.decision === "REQUEST_KAI_CREATIVE" && briefResult === undefined ? (
          <>
            <button
              type="button"
              data-testid="decision-brief-kai-button"
              className={styles.briefButton}
              disabled={briefing || listingId === undefined}
              onClick={handleBriefKai}
            >
              {briefing ? "Membuat brief..." : "Brief Kai Sekarang"}
            </button>
            {listingId === undefined ? (
              <p className={styles.decisionReason}>
                Tidak bisa menentukan listing untuk campaign ini secara otomatis — buat brief manual
                di halaman Listing.
              </p>
            ) : null}
            {briefError !== undefined ? (
              <p data-testid="decision-brief-error" className={styles.errorBox}>
                {briefError}
              </p>
            ) : null}
          </>
        ) : null}

        {decision.decision === "REQUEST_KAI_CREATIVE" && briefResult !== undefined ? (
          <div data-testid="decision-brief-result" className={styles.successBox}>
            {briefResult.createdCount > 0
              ? `${String(briefResult.createdCount)} brief kreatif baru dibuat dan masuk ke antrian review Creative Packages.`
              : (briefResult.skippedReason ?? "Tidak ada brief baru yang dibuat.")}
            {briefResult.cappedByDailyLimit
              ? ` (Diminta ${String(briefResult.requestedCount)}, dibatasi kuota harian ke ${String(briefResult.allowedCount)}.)`
              : ""}
          </div>
        ) : null}
      </div>

      <TrendSection trend={trend} />

      <div className={styles.assessRow}>
        <button
          type="button"
          data-testid="assess-button"
          className={styles.assessButton}
          disabled={assessing}
          onClick={() => void runAssess()}
        >
          {assessing ? "Merekam..." : "Rekam Assessment Ini"}
        </button>
        {assessError !== undefined ? (
          <p data-testid="assess-error" className={styles.assessError}>
            {assessError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default CampaignHealthCard;
