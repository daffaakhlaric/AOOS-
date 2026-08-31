"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/EmptyState";
import { formatIdr, formatNumber, formatPercent } from "@/lib/formatters";
import type { HeatmapCellDto, HeatmapResponseDto } from "@/types/dashboard.types";

import styles from "./HeatmapGrid.module.css";

/**
 * "Audience × Creative Heatmap" (docs/PROMPT-AAOS-ANALYTICS-PLATFORM.md Phase 3) — a grid of real
 * (creative asset × real `AdSet.audienceLabel`) cells, `GET /api/v1/analytics/heatmap`
 * (`apps/aaos-api/src/modules/meta-ads/heatmap-rollup.ts`), consumed via this app's
 * `/api/analytics/heatmap` proxy.
 *
 * CPL-vs-benchmark shading reuses `CampaignTable.tsx`'s own real, cited convention EXACTLY (same
 * `CPL_BENCHMARK_MULTIPLIER = 1.5`, same "tenant's own portfolio average, not an external
 * benchmark" framing — see that file's top docstring) — restated as a local constant here per that
 * same file's own precedent for a value that can't be imported across these package boundaries.
 * The one real difference: `heatmap-rollup.ts` computes `benchmarkCplIDR` SERVER-SIDE (it already
 * holds the full real `AdAccount` tree), so this component reads it straight off the response
 * rather than recomputing a client-side proxy from a flattened DTO the way `CampaignTable.tsx` has
 * to.
 *
 * Clicking a cell links to `/meta-ads/analytics/assets/{assetId}` — Phase 4's real asset detail
 * page, not yet built as of this phase. A 404 until Phase 4 ships is expected and documented, not
 * a placeholder page fabricated here.
 */

const CPL_BENCHMARK_MULTIPLIER = 1.5;

export type HeatmapMetric = "cpl" | "ctr" | "cpm";

const METRIC_OPTIONS: ReadonlyArray<{ readonly id: HeatmapMetric; readonly label: string }> = [
  { id: "cpl", label: "CPL" },
  { id: "ctr", label: "CTR" },
  { id: "cpm", label: "CPM" },
];

const AUDIENCE_LABEL_TEXT_ID: Readonly<Record<string, string>> = {
  BROAD: "Broad",
  INTEREST: "Interest",
  LOOKALIKE_1: "Lookalike 1%",
  RETARGETING: "Retargeting",
  CUSTOM_CRM: "Custom/CRM",
};

function cellValue(cell: HeatmapCellDto, metric: HeatmapMetric): number | null {
  return metric === "cpl" ? cell.cpl : metric === "ctr" ? cell.ctr : cell.cpm;
}

function formatCellValue(value: number | null, metric: HeatmapMetric): string {
  if (value === null) {
    return "—";
  }
  if (metric === "cpl" || metric === "cpm") {
    return formatIdr(value);
  }
  return formatPercent(value);
}

/**
 * CPL-only tone (CTR/CPM have no real benchmark concept in this codebase yet — same "don't invent
 * a second benchmark" discipline `CampaignTable.tsx`'s own docstring establishes; this grid simply
 * shows those two metrics unshaded rather than fabricating a threshold with no real basis).
 */
function cplTone(cpl: number | null, benchmarkCplIDR: number | null): "high" | "normal" | "none" {
  if (cpl === null || benchmarkCplIDR === null || benchmarkCplIDR <= 0) {
    return "none";
  }
  return cpl > benchmarkCplIDR * CPL_BENCHMARK_MULTIPLIER ? "high" : "normal";
}

export interface HeatmapGridProps {
  readonly heatmap: HeatmapResponseDto;
}

export function HeatmapGrid({ heatmap }: HeatmapGridProps): React.ReactElement {
  const [metric, setMetric] = useState<HeatmapMetric>("cpl");

  const cellByKey = useMemo(() => {
    const map = new Map<string, HeatmapCellDto>();
    for (const cell of heatmap.cells) {
      map.set(`${cell.assetId}::${cell.audienceLabel}`, cell);
    }
    return map;
  }, [heatmap.cells]);

  if (heatmap.creativeAssetIds.length === 0 || heatmap.audienceLabels.length === 0) {
    return (
      <EmptyState
        title="Belum ada data untuk heatmap"
        description="Tarik data kampanye dengan kreatif dan audiens yang sudah terklasifikasi untuk melihat heatmap."
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar} role="group" aria-label="Metrik heatmap">
        {METRIC_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={metric === option.id}
            onClick={() => setMetric(option.id)}
            className={`${styles.metricButton} ${metric === option.id ? styles.metricButtonActive : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.scrollContainer}>
        <table data-testid="heatmap-grid" className={styles.grid}>
          <thead>
            <tr>
              <th className={styles.cornerHeader} scope="col">
                Audiens \ Kreatif
              </th>
              {heatmap.creativeAssetIds.map((assetId) => (
                <th key={assetId} className={styles.columnHeader} scope="col" title={assetId}>
                  {assetId.length > 12 ? `${assetId.slice(0, 12)}…` : assetId}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.audienceLabels.map((audienceLabel) => (
              <tr key={audienceLabel}>
                <th className={styles.rowHeader} scope="row">
                  {AUDIENCE_LABEL_TEXT_ID[audienceLabel] ?? audienceLabel}
                </th>
                {heatmap.creativeAssetIds.map((assetId) => {
                  const cell = cellByKey.get(`${assetId}::${audienceLabel}`);
                  if (cell === undefined) {
                    return (
                      <td
                        key={assetId}
                        data-testid="heatmap-cell-empty"
                        className={`${styles.cell} ${styles.cellEmpty}`}
                      >
                        —
                      </td>
                    );
                  }
                  const value = cellValue(cell, metric);
                  const tone =
                    metric === "cpl" ? cplTone(cell.cpl, heatmap.benchmarkCplIDR) : "none";
                  const toneClass =
                    tone === "high" ? styles.cellHigh : tone === "normal" ? styles.cellNormal : "";
                  return (
                    <td key={assetId} data-testid="heatmap-cell" className={styles.cell}>
                      <Link
                        href={`/meta-ads/analytics/assets/${encodeURIComponent(cell.assetId)}`}
                        className={`${styles.cellLink} ${toneClass}`}
                        title={`${cell.assetId} × ${AUDIENCE_LABEL_TEXT_ID[audienceLabel] ?? audienceLabel} — ${cell.adCount} iklan, ${formatNumber(cell.totalLead)} lead`}
                      >
                        <span className={styles.cellValue}>{formatCellValue(value, metric)}</span>
                        <span className={styles.cellSub}>{formatIdr(cell.spend)}</span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {heatmap.untaggedAdCount > 0 ? (
        <p className={styles.untagged}>
          {formatNumber(heatmap.untaggedAdCount)} iklan tidak tampil di heatmap (kreatif atau
          audiens belum terklasifikasi).
        </p>
      ) : null}

      <p data-testid="heatmap-insight" className={styles.insight}>
        {heatmap.insightText}
      </p>
    </div>
  );
}
