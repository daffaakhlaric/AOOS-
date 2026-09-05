"use client";

import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { HeatmapCellDto } from "@/types/dashboard.types";

import styles from "./WinningCombos.module.css";

/**
 * Sprint 5 Prompt 12 "Winning Combos" section — top 3 real creative × audience combinations from
 * the SAME `heatmap.cells` `HeatmapGrid`/`AnalyticsHeatmapClient` already fetch (no second Meta
 * pull). Real gap: no thumbnail image URL exists anywhere in this codebase for a Meta creative
 * (only `image_hash`/`video_id` identifiers) — an honest asset-kind placeholder icon is rendered
 * instead of a fabricated `<img>`, same discipline `CampaignDetailDrawer`'s preview block uses. No
 * real ROAS exists either (no revenue field anywhere in this codebase) — "IMPRESSIONS" is shown
 * per the spec's own trio label instead of a fabricated ROAS card.
 */
export type WinningCombosMetric = "ctr" | "cpl" | "spend";

const METRIC_LABEL: Readonly<Record<WinningCombosMetric, string>> = {
  ctr: "CTR",
  cpl: "CPL",
  spend: "Spend",
};

function metricValue(cell: HeatmapCellDto, metric: WinningCombosMetric): number {
  if (metric === "ctr") {
    return cell.ctr ?? -1;
  }
  if (metric === "cpl") {
    // Lower is better; cells with no computable CPL sort last.
    return cell.cpl === null ? Number.POSITIVE_INFINITY : cell.cpl;
  }
  return cell.spend;
}

function rankCells(
  cells: readonly HeatmapCellDto[],
  metric: WinningCombosMetric,
): readonly HeatmapCellDto[] {
  const sorted = [...cells].sort((a, b) => {
    const va = metricValue(a, metric);
    const vb = metricValue(b, metric);
    return metric === "cpl" ? va - vb : vb - va;
  });
  return sorted.slice(0, 3);
}

const AUDIENCE_LABEL_TEXT_ID: Readonly<Record<string, string>> = {
  BROAD: "Broad",
  INTEREST: "Interest",
  LOOKALIKE_1: "Lookalike 1%",
  RETARGETING: "Retargeting",
  CUSTOM_CRM: "Custom/CRM",
};

export interface WinningCombosProps {
  readonly cells: readonly HeatmapCellDto[];
  readonly metric: WinningCombosMetric;
  readonly onOpenAsset: (assetId: string) => void;
}

export function WinningCombos({
  cells,
  metric,
  onOpenAsset,
}: WinningCombosProps): React.ReactElement | null {
  const top = rankCells(cells, metric);
  if (top.length === 0) {
    return null;
  }

  return (
    <section className={styles.wrap} data-testid="winning-combos">
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Winning Combos</h3>
        <p className={styles.sectionSubtitle}>
          Top performing creative × audience combinations by {METRIC_LABEL[metric]}
        </p>
      </div>
      <div className={styles.cards}>
        {top.map((cell, index) => {
          const rank = index + 1;
          return (
            <button
              key={`${cell.assetId}::${cell.audienceLabel}`}
              type="button"
              data-testid={`winning-combo-card-${rank}`}
              className={`${styles.card} ${rank === 1 ? styles.cardFirst : ""}`}
              onClick={() => onOpenAsset(cell.assetId)}
            >
              <span className={styles.rankBadge}>{rank}</span>
              <div className={styles.thumb}>
                <span className={styles.typeBadge}>
                  {cell.assetKind === "IMAGE" ? "Image" : "Video"}
                </span>
                <span aria-hidden="true" className={styles.thumbIcon}>
                  {cell.assetKind === "IMAGE" ? "🖼" : "🎬"}
                </span>
              </div>
              <span className={styles.name} title={cell.assetId}>
                {cell.assetId.length > 20 ? `${cell.assetId.slice(0, 20)}…` : cell.assetId} ·{" "}
                {AUDIENCE_LABEL_TEXT_ID[cell.audienceLabel] ?? cell.audienceLabel}
              </span>
              <div className={styles.metrics}>
                <span className={styles.metricCtr}>
                  {cell.ctr !== null ? formatPercent(cell.ctr) : "—"}
                </span>
                <span className={styles.metricSecondary}>{formatIdr(cell.spend)}</span>
                <span className={styles.metricSecondary}>{formatNumber(cell.impressions)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default WinningCombos;
