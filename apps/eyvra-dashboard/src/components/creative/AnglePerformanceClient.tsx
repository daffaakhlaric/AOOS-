"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type {
  AnglePerformanceResponseDto,
  AnglePerformanceResultDto,
  DataSufficiencyLevelDto,
} from "@/types/angle-performance.types";

import styles from "./AnglePerformanceClient.module.css";

const DATA_SUFFICIENCY_LABELS: Record<DataSufficiencyLevelDto, string> = {
  INSUFFICIENT: "Data Belum Cukup",
  LOW: "Data Rendah",
  MEDIUM: "Data Sedang",
  HIGH: "Data Tinggi",
};

function dataSufficiencyBadgeClass(level: DataSufficiencyLevelDto): string {
  switch (level) {
    case "INSUFFICIENT":
      return styles.badgeInsufficient ?? "";
    case "LOW":
      return styles.badgeLow ?? "";
    case "MEDIUM":
      return styles.badgeMedium ?? "";
    case "HIGH":
      return styles.badgeHigh ?? "";
  }
}

function AngleRow({ result }: { readonly result: AnglePerformanceResultDto }): React.ReactElement {
  const { angle, packageCount, aggregated, dataSufficiency, rank } = result;
  const isWinner = rank === 1;

  return (
    <div
      data-testid="angle-performance-row"
      className={`${styles.row} ${isWinner ? styles.rowWinner : ""}`}
    >
      <div className={styles.rowHeader}>
        <span data-testid="angle-name" className={styles.angleLabel}>
          {angle}
        </span>
        {rank !== undefined ? (
          <span
            data-testid="angle-rank-badge"
            className={`${styles.rankBadge} ${isWinner ? styles.rankBadgeWinner : ""}`}
          >
            #{rank}
          </span>
        ) : (
          <span
            data-testid="data-sufficiency-badge"
            className={`${styles.badge} ${dataSufficiencyBadgeClass(dataSufficiency.level)}`}
          >
            {DATA_SUFFICIENCY_LABELS[dataSufficiency.level]}
          </span>
        )}
      </div>

      <div className={styles.metricsGrid}>
        <span className={styles.metric}>
          CPL
          <span data-testid="angle-cpl" className={styles.metricValue}>
            {aggregated.cpl !== undefined ? formatIdr(aggregated.cpl) : "Belum ada lead"}
          </span>
        </span>
        <span className={styles.metric}>
          CTR
          <span data-testid="angle-ctr" className={styles.metricValue}>
            {aggregated.ctr !== undefined ? formatPercent(aggregated.ctr) : "—"}
          </span>
        </span>
        <span className={styles.metric}>
          Spend
          <span data-testid="angle-spend" className={styles.metricValue}>
            {formatIdr(aggregated.spend)}
          </span>
        </span>
        <span className={styles.metric}>
          Leads
          <span data-testid="angle-leads" className={styles.metricValue}>
            {formatNumber(aggregated.leads)}
          </span>
        </span>
      </div>

      <div className={styles.footerRow}>
        <span data-testid="angle-package-count" className={styles.packageCount}>
          {packageCount} creative package
        </span>
        {rank !== undefined ? (
          <span
            data-testid="data-sufficiency-badge"
            className={`${styles.badge} ${dataSufficiencyBadgeClass(dataSufficiency.level)}`}
          >
            {DATA_SUFFICIENCY_LABELS[dataSufficiency.level]}
          </span>
        ) : (
          <p data-testid="angle-unranked-note" className={styles.unrankedNote}>
            Belum cukup data untuk diranking
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * `AnglePerformanceClient` (EYVRA — SAMANTHA V2 + KAI V2 Phase 17) — real, tenant-wide angle
 * performance leaderboard from Phase 2's Creative Performance Memory ranking engine (`GET
 * /api/v1/creative-memory/angle-performance`): every real `PropertyAdAngle` this tenant has
 * published creative for, with its real aggregated CPL/CTR/spend/leads and honest
 * `dataSufficiency` classification, ranked (rank 1 = best real CPL) once it clears the `MEDIUM`
 * data-sufficiency bar — angles below that bar are still shown, just honestly unranked.
 *
 * Fetches lifetime data on mount with no required params (no `since`/`until`) — this phase's first
 * UI surface for the endpoint; date-range filtering is left for a later phase, same "don't build
 * UI for a param nothing calls yet" discipline other proxy routes in this app follow.
 *
 * PLACEMENT: a 5th tab (`angle-performance`) in `CreativeHubClient`'s `/creative` hub, alongside
 * `assets`/`ab-results`/`listing`/`review-kai`.
 */
export function AnglePerformanceClient(): React.ReactElement {
  const [data, setData] = useState<AnglePerformanceResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    fetch("/api/creative-memory/angle-performance")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Angle Performance.");
        }
        const body = (await res.json()) as Partial<AnglePerformanceResponseDto>;
        // Defensive, honest shape check — a malformed/unexpected response body must degrade to the
        // real error state below, never crash the whole `/creative` page render tree. Same
        // discipline `OpportunitiesCard`'s own `Array.isArray` check follows.
        if (!Array.isArray(body.angles)) {
          throw new Error("Respons Angle Performance tidak lengkap.");
        }
        return body as AnglePerformanceResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Angle Performance.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return (
      <section data-testid="angle-performance-card" className={styles.section}>
        <h3 className={styles.title}>Angle Performance</h3>
        <p className={styles.errorBox}>{error}</p>
      </section>
    );
  }

  if (data === undefined) {
    return (
      <section data-testid="angle-performance-card" className={styles.section}>
        <h3 className={styles.title}>Angle Performance</h3>
        <LoadingSpinner />
      </section>
    );
  }

  if (data.angles.length === 0) {
    return (
      <section data-testid="angle-performance-card" className={styles.section}>
        <h3 className={styles.title}>Angle Performance</h3>
        <EmptyState
          title="Belum ada data performa angle"
          description="Belum ada data performa angle — publish beberapa campaign dulu."
        />
      </section>
    );
  }

  return (
    <section data-testid="angle-performance-card" className={styles.section}>
      <h3 className={styles.title}>Angle Performance</h3>
      <div className={styles.list}>
        {data.angles.map((result) => (
          <AngleRow key={result.angle} result={result} />
        ))}
      </div>
    </section>
  );
}

export default AnglePerformanceClient;
