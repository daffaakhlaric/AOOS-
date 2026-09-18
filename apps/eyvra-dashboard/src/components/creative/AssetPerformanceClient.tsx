"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type {
  AssetPerformanceResponseDto,
  AssetPerformanceResultDto,
  DataSufficiencyLevelDto,
} from "@/types/asset-performance.types";

import styles from "./AssetPerformanceClient.module.css";

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

/**
 * Real format label from the asset's own `hasVideo`/`imageCount` — never from `decidedFormat` alone
 * (that column is `undefined` for a pre-Sprint-6 row or a row generation never completed for, see
 * `asset-performance.types.ts`'s own doc), so this stays honest even for a row missing it.
 */
function formatLabel(asset: AssetPerformanceResultDto): string {
  return asset.hasVideo ? "Video + Gambar" : "Gambar Saja";
}

function AssetRow({ result }: { readonly result: AssetPerformanceResultDto }): React.ReactElement {
  const { packageId, angle, title, fatigueStatus, imageCount, aggregated, dataSufficiency, rank } =
    result;
  const isWinner = rank === 1;

  return (
    <div
      data-testid="asset-performance-row"
      className={`${styles.row} ${isWinner ? styles.rowWinner : ""}`}
    >
      <div className={styles.rowHeader}>
        <div className={styles.titleBlock}>
          <span data-testid="asset-title" className={styles.assetTitle}>
            {title}
          </span>
          <span data-testid="asset-angle" className={styles.angleLabel}>
            {angle}
          </span>
        </div>
        {rank !== undefined ? (
          <span
            data-testid="asset-rank-badge"
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

      <div className={styles.formatRow}>
        <span data-testid="asset-format-badge" className={`${styles.badge} ${styles.formatBadge}`}>
          {formatLabel(result)}
        </span>
        <span data-testid="asset-image-count" className={styles.imageCount}>
          {imageCount} gambar
        </span>
        {fatigueStatus !== "NORMAL" ? (
          <span
            data-testid="asset-fatigue-badge"
            className={`${styles.badge} ${styles.fatigueBadge}`}
          >
            {fatigueStatus === "FATIGUED" ? "⚠ Fatigue" : "Menurun"}
          </span>
        ) : null}
      </div>

      <div className={styles.metricsGrid}>
        <span className={styles.metric}>
          CPL
          <span data-testid="asset-cpl" className={styles.metricValue}>
            {aggregated.cpl !== undefined ? formatIdr(aggregated.cpl) : "Belum ada lead"}
          </span>
        </span>
        <span className={styles.metric}>
          CTR
          <span data-testid="asset-ctr" className={styles.metricValue}>
            {aggregated.ctr !== undefined ? formatPercent(aggregated.ctr) : "—"}
          </span>
        </span>
        <span className={styles.metric}>
          Spend
          <span data-testid="asset-spend" className={styles.metricValue}>
            {formatIdr(aggregated.spend)}
          </span>
        </span>
        <span className={styles.metric}>
          Leads
          <span data-testid="asset-leads" className={styles.metricValue}>
            {formatNumber(aggregated.leads)}
          </span>
        </span>
      </div>

      <div className={styles.footerRow}>
        <span data-testid="asset-package-id" className={styles.packageId}>
          {packageId}
        </span>
        {rank !== undefined ? (
          <span
            data-testid="data-sufficiency-badge"
            className={`${styles.badge} ${dataSufficiencyBadgeClass(dataSufficiency.level)}`}
          >
            {DATA_SUFFICIENCY_LABELS[dataSufficiency.level]}
          </span>
        ) : (
          <p data-testid="asset-unranked-note" className={styles.unrankedNote}>
            Belum cukup data untuk diranking
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * `AssetPerformanceClient` (EYVRA — SAMANTHA V2 + KAI V2 Phase 22) — real, tenant-wide INDIVIDUAL
 * asset performance leaderboard from Phase 21's Kai V2 Asset Analyzer (`GET
 * /api/v1/creative-memory/asset-performance`): every real, individually-published `creative_packages`
 * row this tenant has, with its own real aggregated CPL/CTR/spend/leads and honest `dataSufficiency`
 * classification, ranked (rank 1 = best real CPL) once it clears the `MEDIUM` data-sufficiency bar —
 * assets below that bar are still shown, just honestly unranked. This is the individual-asset
 * counterpart of `AnglePerformanceClient` (Phase 17), which groups by angle instead — it answers "of
 * the 3 real assets under a winning angle, which ONE is actually carrying the result", which the
 * angle-grouped view alone cannot.
 *
 * Fetches lifetime data on mount with no required params (no `since`/`until`) — same "don't build UI
 * for a param nothing calls yet" discipline `AnglePerformanceClient` already follows.
 *
 * PLACEMENT: a 6th tab (`asset-performance`) in `CreativeHubClient`'s `/creative` hub, alongside
 * `assets`/`ab-results`/`listing`/`review-kai`/`angle-performance`.
 */
export function AssetPerformanceClient(): React.ReactElement {
  const [data, setData] = useState<AssetPerformanceResponseDto | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setError(undefined);
    fetch("/api/creative-memory/asset-performance")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("Gagal memuat Asset Performance.");
        }
        const body = (await res.json()) as Partial<AssetPerformanceResponseDto>;
        // Defensive, honest shape check — a malformed/unexpected response body must degrade to the
        // real error state below, never crash the whole `/creative` page render tree. Same
        // discipline `AnglePerformanceClient`'s own `Array.isArray` check follows.
        if (!Array.isArray(body.assets)) {
          throw new Error("Respons Asset Performance tidak lengkap.");
        }
        return body as AssetPerformanceResponseDto;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal memuat Asset Performance.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error !== undefined) {
    return (
      <section data-testid="asset-performance-card" className={styles.section}>
        <h3 className={styles.title}>Asset Performance</h3>
        <p className={styles.errorBox}>{error}</p>
      </section>
    );
  }

  if (data === undefined) {
    return (
      <section data-testid="asset-performance-card" className={styles.section}>
        <h3 className={styles.title}>Asset Performance</h3>
        <LoadingSpinner />
      </section>
    );
  }

  if (data.assets.length === 0) {
    return (
      <section data-testid="asset-performance-card" className={styles.section}>
        <h3 className={styles.title}>Asset Performance</h3>
        <EmptyState
          title="Belum ada data performa asset"
          description="Belum ada data performa asset — publish beberapa creative package dulu."
        />
      </section>
    );
  }

  return (
    <section data-testid="asset-performance-card" className={styles.section}>
      <h3 className={styles.title}>Asset Performance</h3>
      <div className={styles.list}>
        {data.assets.map((result) => (
          <AssetRow key={result.packageId} result={result} />
        ))}
      </div>
    </section>
  );
}

export default AssetPerformanceClient;
