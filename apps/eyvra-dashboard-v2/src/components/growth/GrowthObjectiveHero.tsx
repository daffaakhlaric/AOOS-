"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { formatDateId, formatNumber } from "@/lib/formatters";
import type {
  GrowthObjectiveListResponseDto,
  GrowthObjectiveResponseDto,
} from "@/types/dashboard.types";

import { presentLabel } from "@/lib/presentation";

import styles from "./GrowthObjectiveHero.module.css";

const ACTIVE_LIKE_STATUSES = new Set(["ACTIVE", "ON_TRACK", "AT_RISK", "OFF_TRACK", "REPLANNING"]);

function pickCurrentObjective(
  objectives: readonly GrowthObjectiveResponseDto[],
): GrowthObjectiveResponseDto | undefined {
  const activeLike = objectives.filter((objective) => ACTIVE_LIKE_STATUSES.has(objective.status));
  const pool = activeLike.length > 0 ? activeLike : objectives;
  return [...pool].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

function daysLeft(endDate: string): number {
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function statusLine(objective: GrowthObjectiveResponseDto): string {
  const progress = objective.progress;
  if (progress?.campaignsOnPace !== undefined && progress.campaignsTotal !== undefined) {
    return `${progress.campaignsOnPace} dari ${progress.campaignsTotal} campaign on pace.`;
  }
  if (progress?.onTrack === true) {
    return "Objective saat ini on track berdasarkan data progress terakhir.";
  }
  if (progress?.onTrack === false) {
    return "Objective saat ini di luar jalur (off pace) berdasarkan data progress terakhir.";
  }
  return "Progress belum pernah dihitung — jalankan pengecekan progress untuk melihat status pace.";
}

export function GrowthObjectiveHero(): React.ReactElement {
  const [objectives, setObjectives] = useState<readonly GrowthObjectiveResponseDto[] | undefined>(
    undefined,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/growth-objectives")
      .then((res) => (res.ok ? (res.json() as Promise<GrowthObjectiveListResponseDto>) : null))
      .then((body) => {
        if (!cancelled) {
          if (body === null) {
            setFailed(true);
          } else {
            setObjectives(body.objectives);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Card testId="cc-growth-objective">
        <ErrorState message="Data Growth Objective belum bisa dimuat. Coba muat ulang halaman." />
      </Card>
    );
  }

  if (objectives === undefined) {
    return (
      <Card testId="cc-growth-objective">
        <LoadingState processLabel="Memuat Growth Objective..." />
      </Card>
    );
  }

  const current = pickCurrentObjective(objectives);

  if (current === undefined) {
    return (
      <Card testId="cc-growth-objective" variant="hero">
        <div className={styles.emptyHero}>
          <EmptyState
            compact
            title="🎯 Set your Growth Objective"
            description="Tell Samantha the business result you want to achieve."
            action={
              <Link href="/growth-objectives" className={styles.createLink}>
                Create Growth Objective →
              </Link>
            }
          />
        </div>
      </Card>
    );
  }

  const target = current.targetValue;
  const actual = current.progress?.actualValue;
  const percent =
    current.progress?.percentComplete !== undefined
      ? Math.min(100, Math.max(0, Math.round(current.progress.percentComplete * 100)))
      : actual !== undefined && target > 0
        ? Math.min(100, Math.round((actual / target) * 100))
        : 0;
  const remaining = current.progress?.daysRemaining ?? daysLeft(current.endDate);
  const achievable = current.forecast?.achievableHotLeads;

  return (
    <Card testId="cc-growth-objective" variant="hero">
      <div className={styles.hero} data-testid="cc-growth-objective-active">
        <div
          className={styles.identityBlock}
          title={`${formatDateId(current.startDate)} – ${formatDateId(current.endDate)}`}
        >
          <p className={styles.eyebrow}>Growth Objective</p>
          <p className={styles.bigValue}>
            {actual !== undefined
              ? `${formatNumber(actual)} / ${formatNumber(target)} HOT LEADS`
              : `Target ${formatNumber(target)} Hot Leads`}
          </p>
        </div>

        <span className={styles.statusPill} data-testid="cc-objective-status">
          {presentLabel(current.status)}
        </span>

        <div className={styles.progressBlock}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.progressMeta}>
            {actual !== undefined
              ? `${formatNumber(actual)}/${formatNumber(target)}`
              : `${percent}%`}{" "}
            · {remaining} hari tersisa
          </p>
        </div>

        <div className={styles.metricsRow}>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Current</p>
            <p className={styles.metricValue}>
              {current.progress?.currentDailyPace !== undefined
                ? `${current.progress.currentDailyPace.toLocaleString("id-ID", { maximumFractionDigits: 1 })}/day`
                : "—"}
            </p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Required</p>
            <p className={styles.metricValue}>
              {current.progress?.requiredDailyPace !== undefined
                ? `${current.progress.requiredDailyPace.toLocaleString("id-ID", { maximumFractionDigits: 1 })}/day`
                : "—"}
            </p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Forecast</p>
            <p className={styles.metricValue}>
              {achievable !== undefined
                ? `${formatNumber(achievable.low)}–${formatNumber(achievable.high)}`
                : "—"}
            </p>
          </div>
          <div className={styles.metricCell}>
            <p className={styles.metricLabel}>Days Left</p>
            <p className={styles.metricValue}>{remaining}</p>
          </div>
        </div>

        <p
          className={styles.statusLine}
          data-testid="cc-objective-status-line"
          title={statusLine(current)}
        >
          {statusLine(current)}
        </p>

        <Link href="/growth-objectives" className={styles.reviewLink}>
          Review Plan →
        </Link>
      </div>
    </Card>
  );
}
