"use client";

import { useCallback, useEffect, useState } from "react";

import { ErrorCard } from "@/components/ui/ErrorCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr } from "@/lib/formatters";
import type {
  EstimatedRange,
  FeasibilityResult,
  GrowthObjectiveResponseDto,
  GrowthObjectiveStatus,
  ObjectiveProgressResult,
  PacingResponseDto,
} from "@/types/growth-objective.types";

import styles from "./GrowthObjectiveDetailClient.module.css";

export interface GrowthObjectiveDetailClientProps {
  readonly objectiveId: string;
}

/** Same real Indonesian labels `GrowthObjectivesClient.tsx` (Phase 15) already established — kept in sync, never re-invented. */
const STATUS_LABELS: Record<GrowthObjectiveStatus, string> = {
  DRAFT: "Draft",
  ANALYZING: "Menganalisis",
  PLANNED: "Terencana",
  ACTIVE: "Aktif",
  ON_TRACK: "On Track",
  AT_RISK: "Berisiko",
  OFF_TRACK: "Melenceng",
  REPLANNING: "Rencana Ulang",
  COMPLETED: "Selesai",
  PAUSED: "Dijeda",
};

/** Same real status-badge color convention `GrowthObjectivesClient.tsx` (Phase 15) already established — reused verbatim, not a new palette. */
function statusBadgeClass(status: GrowthObjectiveStatus): string {
  switch (status) {
    case "DRAFT":
    case "ANALYZING":
    case "PLANNED":
    case "PAUSED":
    case "REPLANNING":
      return styles.badgeNeutral ?? "";
    case "ACTIVE":
    case "ON_TRACK":
      return styles.badgeGood ?? "";
    case "AT_RISK":
      return styles.badgeWarn ?? "";
    case "OFF_TRACK":
      return styles.badgeBad ?? "";
    case "COMPLETED":
      return styles.badgeDone ?? "";
  }
}

const FEASIBILITY_LABELS: Record<FeasibilityResult["status"], string> = {
  ACHIEVABLE: "Achievable",
  AGGRESSIVE: "Aggressive",
  AT_RISK: "Berisiko",
  UNLIKELY: "Tidak Mungkin",
  INSUFFICIENT_DATA: "Data Tidak Cukup",
};

function feasibilityBadgeClass(status: FeasibilityResult["status"]): string {
  switch (status) {
    case "ACHIEVABLE":
      return styles.badgeGood ?? "";
    case "AGGRESSIVE":
      return styles.badgeWarn ?? "";
    case "AT_RISK":
      return styles.badgeWarn ?? "";
    case "UNLIKELY":
      return styles.badgeBad ?? "";
    case "INSUFFICIENT_DATA":
      return styles.badgeNeutral ?? "";
  }
}

const PROGRESS_STATUS_LABELS: Record<ObjectiveProgressResult["status"], string> = {
  COMPLETED: "Selesai",
  ON_TRACK: "On Track",
  AT_RISK: "Berisiko",
  OFF_TRACK: "Melenceng",
};

function progressBadgeClass(status: ObjectiveProgressResult["status"]): string {
  switch (status) {
    case "COMPLETED":
      return styles.badgeDone ?? "";
    case "ON_TRACK":
      return styles.badgeGood ?? "";
    case "AT_RISK":
      return styles.badgeWarn ?? "";
    case "OFF_TRACK":
      return styles.badgeBad ?? "";
  }
}

const PACING_STATUS_LABELS: Record<PacingResponseDto["pacing"]["status"], string> = {
  UNDER_PACING: "Under Pacing",
  ON_PACE: "On Pace",
  OVER_PACING: "Over Pacing",
  UNKNOWN: "Belum Diketahui",
};

function pacingBadgeClass(status: PacingResponseDto["pacing"]["status"]): string {
  switch (status) {
    case "ON_PACE":
      return styles.badgeGood ?? "";
    case "UNDER_PACING":
      return styles.badgeNeutral ?? "";
    case "OVER_PACING":
      return styles.badgeBad ?? "";
    case "UNKNOWN":
      return styles.badgeNeutral ?? "";
  }
}

const SPEND_SOURCE_LABELS: Record<PacingResponseDto["spendSource"], string> = {
  MATCHED_CAMPAIGNS: "Campaign yang cocok dengan objective ini",
  ACCOUNT_WIDE: "Seluruh akun (tidak ada focus listing untuk dicocokkan)",
};

async function parseError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  return body.error?.message ?? fallback;
}

function formatRange(range: EstimatedRange): string {
  return `${range.min.toLocaleString("id-ID")} – ${range.max.toLocaleString("id-ID")} (estimasi ${range.expected.toLocaleString("id-ID")})`;
}

function formatIdrRange(range: EstimatedRange): string {
  return `${formatIdr(range.min)} – ${formatIdr(range.max)} (estimasi ${formatIdr(range.expected)})`;
}

type ActionKey = "analyze" | "activate" | "checkProgress";

/**
 * `/growth-objectives/:id` detail client (EYVRA — SAMANTHA V2 Phase 16) — real fetch-on-mount
 * single objective, a real independent best-effort `/pacing` fetch (mirrors
 * `CampaignInsightPanel.tsx`'s own best-effort-fetch, honest-absence-on-failure pattern), and the
 * three real status-gated action buttons (`/analyze`, `/activate`, `/check-progress`) that trigger
 * `aaos-api`'s real, already-shipped backend transitions. Every section shows an honest "belum
 * pernah ..." message when its real data is absent — never a blank section or a fabricated value
 * (same discipline `CampaignHealthCard.tsx` established for this codebase's optional/nested data).
 */
export function GrowthObjectiveDetailClient({
  objectiveId,
}: GrowthObjectiveDetailClientProps): React.ReactElement {
  const [objective, setObjective] = useState<GrowthObjectiveResponseDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);

  const [pacing, setPacing] = useState<PacingResponseDto | undefined>(undefined);

  const [pendingAction, setPendingAction] = useState<ActionKey | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const loadObjective = useCallback(() => {
    return fetch(`/api/growth-objectives/${encodeURIComponent(objectiveId)}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(await parseError(res, "Gagal memuat Growth Objective."));
        }
        return (await res.json()) as GrowthObjectiveResponseDto;
      })
      .then((body) => {
        setObjective(body);
        setLoadError(undefined);
      })
      .catch((caught: unknown) => {
        setLoadError(caught instanceof Error ? caught.message : "Gagal memuat Growth Objective.");
      });
  }, [objectiveId]);

  const loadPacing = useCallback(() => {
    setPacing(undefined);
    fetch(`/api/growth-objectives/${encodeURIComponent(objectiveId)}/pacing`)
      .then((res) => (res.ok ? (res.json() as Promise<PacingResponseDto>) : undefined))
      .then((body) => {
        setPacing(body);
      })
      .catch(() => {
        // Best-effort only — the Pacing section just shows its honest-absent state.
      });
  }, [objectiveId]);

  useEffect(() => {
    void loadObjective();
  }, [loadObjective]);

  useEffect(() => {
    loadPacing();
  }, [loadPacing]);

  async function runAction(action: ActionKey, path: string): Promise<void> {
    setPendingAction(action);
    setActionError(undefined);
    try {
      const response = await fetch(
        `/api/growth-objectives/${encodeURIComponent(objectiveId)}${path}`,
        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error(await parseError(response, "Aksi gagal dijalankan."));
      }
      const updated = (await response.json()) as GrowthObjectiveResponseDto;
      setObjective(updated);
      loadPacing();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Aksi gagal dijalankan.");
    } finally {
      setPendingAction(undefined);
    }
  }

  if (loadError !== undefined && objective === undefined) {
    return <ErrorCard message={loadError} />;
  }
  if (objective === undefined) {
    return <LoadingSpinner />;
  }

  const canAnalyze = objective.status === "DRAFT" || objective.status === "REPLANNING";
  const canActivate = objective.status === "PLANNED";
  const canCheckProgress =
    objective.status === "ACTIVE" ||
    objective.status === "ON_TRACK" ||
    objective.status === "AT_RISK" ||
    objective.status === "OFF_TRACK";

  return (
    <div className={styles.page} data-testid="growth-objective-detail">
      {loadError !== undefined ? <ErrorCard message={loadError} /> : null}

      <div className={styles.headerCard} data-testid="objective-header">
        <div className={styles.headerTop}>
          <span className={styles.metric}>
            {objective.metric === "HOT_LEADS" ? "Hot Leads" : objective.metric}
          </span>
          <span
            data-testid="objective-status-badge"
            className={`${styles.badge} ${statusBadgeClass(objective.status)}`}
          >
            {STATUS_LABELS[objective.status]}
          </span>
        </div>
        <p className={styles.target}>Target: {objective.targetValue.toLocaleString("id-ID")}</p>
        <p className={styles.dateRange}>
          {objective.startDate} — {objective.endDate}
        </p>
      </div>

      <div className={styles.actionsRow} data-testid="objective-actions">
        {canAnalyze ? (
          <button
            type="button"
            data-testid="action-analyze-button"
            className={styles.actionButton}
            disabled={pendingAction !== undefined}
            onClick={() => void runAction("analyze", "/analyze")}
          >
            {pendingAction === "analyze" ? "Menganalisa..." : "Analisa"}
          </button>
        ) : null}
        {canActivate ? (
          <button
            type="button"
            data-testid="action-activate-button"
            className={styles.actionButton}
            disabled={pendingAction !== undefined}
            onClick={() => void runAction("activate", "/activate")}
          >
            {pendingAction === "activate" ? "Mengaktifkan..." : "Aktifkan"}
          </button>
        ) : null}
        {canCheckProgress ? (
          <button
            type="button"
            data-testid="action-check-progress-button"
            className={styles.actionButton}
            disabled={pendingAction !== undefined}
            onClick={() => void runAction("checkProgress", "/check-progress")}
          >
            {pendingAction === "checkProgress" ? "Mengecek..." : "Cek Progress"}
          </button>
        ) : null}
      </div>

      {actionError !== undefined ? (
        <p className={styles.actionError} data-testid="action-error">
          {actionError}
        </p>
      ) : null}

      <section className={styles.section} data-testid="forecast-section">
        <h3 className={styles.sectionTitle}>Forecast</h3>
        {objective.forecast === undefined ? (
          <p className={styles.emptyText} data-testid="forecast-empty">
            Belum pernah dianalisa — klik Analisa untuk menghitung forecast.
          </p>
        ) : (
          <div className={styles.sectionBody}>
            <div className={styles.subBlock} data-testid="reverse-funnel-block">
              <h4 className={styles.subTitle}>Reverse Funnel</h4>
              <p className={styles.line}>
                Conversion Rate:{" "}
                {objective.forecast.reverseFunnel.conversionRate !== undefined
                  ? `${Math.round(objective.forecast.reverseFunnel.conversionRate * 100)}%`
                  : "Belum bisa dihitung (belum ada raw lead historis)."}
              </p>
              <p className={styles.line}>
                Estimasi Raw Lead Dibutuhkan:{" "}
                {objective.forecast.reverseFunnel.estimatedRequiredRawLeads !== undefined
                  ? formatRange(objective.forecast.reverseFunnel.estimatedRequiredRawLeads)
                  : "Belum bisa dihitung."}
              </p>
              <p className={styles.line}>
                Estimasi Media Spend:{" "}
                {objective.forecast.reverseFunnel.estimatedMediaSpendIdr !== undefined
                  ? formatIdrRange(objective.forecast.reverseFunnel.estimatedMediaSpendIdr)
                  : "Belum bisa dihitung (belum ada benchmark CPL yang bisa dipercaya)."}
              </p>
              <p className={styles.line}>
                Confidence: {Math.round(objective.forecast.reverseFunnel.confidence * 100)}%
              </p>
            </div>

            <div className={styles.subBlock} data-testid="feasibility-block">
              <h4 className={styles.subTitle}>Feasibility</h4>
              <span
                data-testid="feasibility-status-badge"
                className={`${styles.badge} ${feasibilityBadgeClass(objective.forecast.feasibility.status)}`}
              >
                {FEASIBILITY_LABELS[objective.forecast.feasibility.status]}
              </span>
              <p className={styles.line}>
                Confidence: {Math.round(objective.forecast.feasibility.confidence * 100)}%
              </p>
              {objective.forecast.feasibility.reasons.length > 0 ? (
                <ul className={styles.list} data-testid="feasibility-reasons">
                  {objective.forecast.feasibility.reasons.map((reason, index) => (
                    <li key={`${reason}-${String(index)}`} className={styles.listItem}>
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              {objective.forecast.feasibility.options.length > 0 ? (
                <div className={styles.metaRow} data-testid="feasibility-options">
                  {objective.forecast.feasibility.options.map((option) => (
                    <span key={option} className={styles.metaChip}>
                      {option}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className={styles.section} data-testid="progress-section">
        <h3 className={styles.sectionTitle}>Progress</h3>
        {objective.progress === undefined ? (
          <p className={styles.emptyText} data-testid="progress-empty">
            Belum pernah dicek progressnya.
          </p>
        ) : (
          <div className={styles.sectionBody} data-testid="progress-body">
            <span
              data-testid="progress-status-badge"
              className={`${styles.badge} ${progressBadgeClass(objective.progress.status)}`}
            >
              {PROGRESS_STATUS_LABELS[objective.progress.status]}
            </span>
            <p className={styles.line}>
              Progress: {Math.round(objective.progress.progressPct * 100)}%
            </p>
            <p className={styles.line}>Hari Berjalan: {objective.progress.daysElapsed}</p>
            <p className={styles.line}>Sisa Hari: {objective.progress.daysRemaining}</p>
            <p className={styles.line}>
              Pace Harian Saat Ini: {objective.progress.currentDailyPace.toFixed(2)} / hari
            </p>
            <p className={styles.line}>
              Pace Harian Dibutuhkan:{" "}
              {objective.progress.requiredDailyPace !== undefined
                ? `${objective.progress.requiredDailyPace.toFixed(2)} / hari`
                : "Tidak diperlukan lagi (target sudah tercapai atau waktu sudah habis)."}
            </p>
            <p className={styles.line}>
              Proyeksi Hasil Akhir: {Math.round(objective.progress.projectedFinalCount)}
            </p>
          </div>
        )}
      </section>

      <section className={styles.section} data-testid="pacing-section">
        <h3 className={styles.sectionTitle}>Pacing</h3>
        {pacing === undefined ? (
          <p className={styles.emptyText} data-testid="pacing-empty">
            Data pacing belum tersedia.
          </p>
        ) : (
          <div className={styles.sectionBody} data-testid="pacing-body">
            <span
              data-testid="pacing-status-badge"
              className={`${styles.badge} ${pacingBadgeClass(pacing.pacing.status)}`}
            >
              {PACING_STATUS_LABELS[pacing.pacing.status]}
            </span>
            <p className={styles.line} data-testid="pacing-spend-source">
              Sumber Spend: {SPEND_SOURCE_LABELS[pacing.spendSource]}
            </p>
            <p className={styles.line}>Actual Spend: {formatIdr(pacing.pacing.actualSpendIdr)}</p>
            <p className={styles.line}>
              Expected Spend s/d Hari Ini:{" "}
              {pacing.pacing.expectedSpendToDateIdr !== undefined
                ? formatIdr(pacing.pacing.expectedSpendToDateIdr)
                : "Tidak ada — max budget belum diset atau data spend belum tersedia."}
            </p>
            <p className={styles.line}>
              Pacing:{" "}
              {pacing.pacing.pacingPct !== undefined
                ? `${Math.round(pacing.pacing.pacingPct * 100)}%`
                : "Tidak bisa dihitung."}
            </p>
            <p className={styles.line}>
              Proyeksi Spend Akhir Periode:{" "}
              {pacing.pacing.projectedEndOfPeriodSpendIdr !== undefined
                ? formatIdr(pacing.pacing.projectedEndOfPeriodSpendIdr)
                : "Tidak bisa dihitung."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default GrowthObjectiveDetailClient;
