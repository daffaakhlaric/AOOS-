import { z } from "zod";

import type { DataSufficiencyResult } from "../domain/data-sufficiency.js";
import { METRIC_WINDOW_KEYS, type MetricWindowKey } from "../domain/metric-window.js";

/** `GET .../metric-snapshots/{campaign/:campaignId,account}` query — `window` validates against the real `MetricWindowKey` union, never a hand-copied second enum. Defaults to `"last_7_days"`, the same default shape `CampaignHistoryQuerySchema`'s `days` establishes for a comparable endpoint. */
export const MetricSnapshotQuerySchema = z.object({
  window: z
    .enum(METRIC_WINDOW_KEYS as [MetricWindowKey, ...MetricWindowKey[]])
    .default("last_7_days"),
});
export type MetricSnapshotQueryDto = z.infer<typeof MetricSnapshotQuerySchema>;

export interface SampleSizeDto {
  readonly impressions: number;
  readonly clicks: number;
  readonly leads: number;
}

/**
 * Real, aggregated-and-derived metrics for one window (see `domain/aggregate-insights.ts`), plus
 * the `sampleSize`/`daysCovered`/`dataSufficiency` a caller needs to judge how much to trust the
 * numbers above — never presented bare, never implying more confidence than the underlying
 * `meta_insights_daily` rows actually support.
 */
export interface MetricSnapshotDto {
  readonly window: MetricWindowKey;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly leads: number;
  readonly ctr?: number;
  readonly cpm?: number;
  readonly cpc?: number;
  readonly cpl?: number;
  readonly frequency?: number;
  readonly sampleSize: SampleSizeDto;
  /** Distinct dates ACTUALLY present in the underlying rows for this window — NOT the window's nominal length. A `last_7_days` window with only 2 real synced days honestly reports `2` here, never a fabricated `7`. */
  readonly daysCovered: number;
  readonly dataSufficiency: DataSufficiencyResult;
}

export interface CampaignMetricSnapshotResponseDto extends MetricSnapshotDto {
  readonly campaignId: string;
}
