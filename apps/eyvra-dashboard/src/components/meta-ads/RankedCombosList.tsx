"use client";

import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { HeatmapCellDto } from "@/types/dashboard.types";

import type { WinningCombosMetric } from "./WinningCombos";
import styles from "./RankedCombosList.module.css";

/** Sprint 5 Prompt 12 "RANKED" mode — flat list of every real creative × audience cell, sorted by
 * the active metric. Same real `cells` data as `HeatmapGrid`'s MATRIX mode and `WinningCombos`. */

const AUDIENCE_LABEL_TEXT_ID: Readonly<Record<string, string>> = {
  BROAD: "Broad",
  INTEREST: "Interest",
  LOOKALIKE_1: "Lookalike 1%",
  RETARGETING: "Retargeting",
  CUSTOM_CRM: "Custom/CRM",
};

function metricValue(cell: HeatmapCellDto, metric: WinningCombosMetric): number {
  if (metric === "ctr") {
    return cell.ctr ?? -1;
  }
  if (metric === "cpl") {
    return cell.cpl === null ? Number.POSITIVE_INFINITY : cell.cpl;
  }
  return cell.spend;
}

export interface RankedCombosListProps {
  readonly cells: readonly HeatmapCellDto[];
  readonly metric: WinningCombosMetric;
  readonly onOpenAsset: (assetId: string) => void;
}

export function RankedCombosList({
  cells,
  metric,
  onOpenAsset,
}: RankedCombosListProps): React.ReactElement {
  const sorted = [...cells].sort((a, b) => {
    const va = metricValue(a, metric);
    const vb = metricValue(b, metric);
    return metric === "cpl" ? va - vb : vb - va;
  });

  return (
    <ol className={styles.list} data-testid="ranked-combos-list">
      {sorted.map((cell, index) => (
        <li key={`${cell.assetId}::${cell.audienceLabel}`} className={styles.row}>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => onOpenAsset(cell.assetId)}
          >
            <span className={styles.rank}>{index + 1}</span>
            <span aria-hidden="true" className={styles.thumb}>
              {cell.assetKind === "IMAGE" ? "🖼" : "🎬"}
            </span>
            <span className={styles.name} title={cell.assetId}>
              {cell.assetId.length > 16 ? `${cell.assetId.slice(0, 16)}…` : cell.assetId}
            </span>
            <span className={styles.segment}>
              {AUDIENCE_LABEL_TEXT_ID[cell.audienceLabel] ?? cell.audienceLabel}
            </span>
            <span className={styles.metrics}>
              <span>{cell.ctr !== null ? formatPercent(cell.ctr) : "—"}</span>
              <span>{formatIdr(cell.spend)}</span>
              <span>{formatNumber(cell.impressions)}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export default RankedCombosList;
