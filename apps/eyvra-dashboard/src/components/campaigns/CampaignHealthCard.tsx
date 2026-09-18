"use client";

import { useEffect, useState } from "react";

import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import type {
  CampaignHealthResponseDto,
  HealthDimensionDto,
  HealthStatusDto,
} from "@/types/campaign-health.types";

import styles from "./CampaignHealthCard.module.css";

export interface CampaignHealthCardProps {
  readonly campaignId: string;
  readonly campaignName: string;
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
}: {
  readonly name: string;
  readonly dimension: HealthDimensionDto;
}): React.ReactElement {
  return (
    <div data-testid="health-dimension-row" className={styles.dimensionRow}>
      <div className={styles.dimensionHeader}>
        <span className={styles.dimensionLabel}>{name}</span>
        <StatusBadge status={dimension.status} testId="dimension-status-badge" />
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
 * `CampaignHealthCard` (EYVRA — SAMANTHA V2 Phase 14) — real per-campaign multi-dimension
 * `CampaignHealth`/`CampaignDiagnosis`/`SamanthaDecision` (Phase 3/4's pure, deterministic
 * assessment engine — no LLM call), surfaced VISUALLY for the first time. Previously this same
 * real data was only computed silently to feed Phase 12's `CampaignInsightPanel` LLM prompt
 * (`GET /api/campaign-health/:campaignId`, already existing since Phase 12) — never rendered to
 * the user. This card reuses that exact same existing proxy route, no new backend surface.
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
}: CampaignHealthCardProps): React.ReactElement {
  const [data, setData] = useState<CampaignHealthResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
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

  return (
    <section data-testid="campaign-health-card" className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.title}>Campaign Health — {campaignName}</h3>
        <StatusBadge status={health.overallStatus} testId="overall-status-badge" />
      </div>

      <div className={styles.dimensionGrid}>
        {DIMENSION_ORDER.map((name) => (
          <DimensionRow key={name} name={DIMENSION_LABELS[name]} dimension={health[name]} />
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
      </div>
    </section>
  );
}

export default CampaignHealthCard;
