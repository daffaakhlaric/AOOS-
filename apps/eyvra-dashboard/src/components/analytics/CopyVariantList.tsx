"use client";

import { useState } from "react";

import { formatIdr, formatNumber } from "@/lib/formatters";

import styles from "./CopyVariantList.module.css";

/**
 * Shared "Copy Variations" list (Sprint 5 Prompt 11 Blok 3 / reused by the Prompt 12 read-only
 * asset-detail modal) — genuinely reused, not duplicated, between `CampaignDetailDrawer.tsx` and
 * the heatmap's asset detail view. See this module's own test for a real assertion of that reuse.
 *
 * Honest degrade from the spec's literal "CTR | ROAS | SPEND" columns: neither the already-loaded
 * campaign snapshot (`AdMetricsDto` — no `impressions` field at all) nor the real
 * `AssetDetailResponseDto` (`copyVariants` — no revenue field anywhere in this codebase) carries a
 * real CTR or ROAS per variant. This list instead shows whatever real metrics its caller supplies
 * per variant (each caller picks its own real, honestly-labeled metric set — e.g. Spend/Total
 * Lead/CPL) via `metrics`, rather than fabricating CTR/ROAS numbers that were never pulled.
 */
export interface CopyVariantMetric {
  readonly label: string;
  readonly value: number;
  readonly format: "idr" | "number";
}

export interface CopyVariant {
  readonly id: string;
  readonly name: string;
  readonly copyPreview: string;
  readonly metrics: readonly CopyVariantMetric[];
  /** Real ranking value used to pick the single WINNING badge — caller decides which real metric
   * "best" means for its own sort mode (e.g. lowest CPL, highest spend). */
  readonly rankValue: number;
  readonly rankDirection: "lowerIsBetter" | "higherIsBetter";
}

function formatMetric(metric: CopyVariantMetric): string {
  return metric.format === "idr" ? formatIdr(metric.value) : formatNumber(metric.value);
}

function findWinningId(variants: readonly CopyVariant[]): string | undefined {
  const [first, ...rest] = variants;
  if (first === undefined) {
    return undefined;
  }
  return rest.reduce((best, current) => {
    const currentBetter =
      current.rankDirection === "lowerIsBetter"
        ? current.rankValue < best.rankValue
        : current.rankValue > best.rankValue;
    return currentBetter ? current : best;
  }, first).id;
}

export interface CopyVariantListProps {
  readonly variants: readonly CopyVariant[];
  readonly emptyMessage?: string;
}

export function CopyVariantList({
  variants,
  emptyMessage = "Belum ada variant copy untuk ditampilkan.",
}: CopyVariantListProps): React.ReactElement {
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const winningId = findWinningId(variants);

  if (variants.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ul className={styles.list} data-testid="copy-variant-list">
      {variants.map((variant) => {
        const isExpanded = expandedId === variant.id;
        const isWinning = variant.id === winningId;
        return (
          <li key={variant.id} className={styles.row}>
            <button
              type="button"
              className={styles.rowButton}
              aria-expanded={isExpanded}
              onClick={() => setExpandedId(isExpanded ? undefined : variant.id)}
            >
              <span aria-hidden="true" className={styles.chevron}>
                {isExpanded ? "▼" : "▶"}
              </span>
              <div className={styles.nameBlock}>
                <span className={styles.name}>
                  {variant.name}
                  {isWinning ? (
                    <span className={styles.winningBadge} data-testid="winning-badge">
                      WINNING
                    </span>
                  ) : null}
                </span>
                {!isExpanded ? (
                  <span className={styles.copyPreview}>{variant.copyPreview}</span>
                ) : null}
              </div>
              <div className={styles.metricsRow}>
                {variant.metrics.map((metric) => (
                  <span key={metric.label} className={styles.metricPair}>
                    <span className={styles.metricLabel}>{metric.label}</span>
                    <span className={styles.metricValue}>{formatMetric(metric)}</span>
                  </span>
                ))}
              </div>
            </button>
            {isExpanded ? (
              <div className={styles.expanded}>
                <p className={styles.fullCopy}>{variant.copyPreview}</p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default CopyVariantList;
