import { Injectable } from "@nestjs/common";

import { aggregateInsightRows } from "./domain/aggregate-insights.js";
import { assessDataSufficiency } from "./domain/data-sufficiency.js";
import {
  resolveWindowDateRange,
  type MetricWindowKey,
  type WindowDateRange,
} from "./domain/metric-window.js";
import type { MetricSnapshotDto } from "./dto/metric-snapshot.dto.js";
import {
  MetricSnapshotRepository,
  type InsightRow,
} from "./infrastructure/metric-snapshot.repository.js";

/** A real, minimal spend read for a caller (e.g. `GrowthObjectivesService.pacing`) that needs just the summed spend + row count over an arbitrary CUSTOM date range — not one of `MetricWindowKey`'s fixed window keys, and not the fuller `MetricSnapshotDto` (`ctr`/`cpm`/`dataSufficiency`/etc. it doesn't need). */
export interface RangeSpendResult {
  readonly spend: number;
  /** Real count of underlying `meta_insights_daily` rows summed — `0` means genuinely no synced data for this range (distinct from a real `spend` of `0` backed by real rows), same "0 vs UNKNOWN" honesty `pacing.ts`'s `spendDataAvailable` needs. */
  readonly rowCount: number;
}

/**
 * `modules/metric-snapshot` (EYVRA — SAMANTHA V2 Phase 1 Part B, first half). Resolves a
 * `MetricWindowKey` to a real date range, reads the matching real `meta_insights_daily` rows via
 * `MetricSnapshotRepository`, then aggregates + assesses data sufficiency over them — the same
 * "pure domain functions over already-fetched rows" composition `GrowthObjectivesService` already
 * establishes for this phase's other modules.
 *
 * Deliberately does NOT implement Reverse Funnel/Feasibility/Signal Engine — this module produces
 * the real metric snapshots those later engines will read, nothing more.
 */
@Injectable()
export class MetricSnapshotService {
  constructor(private readonly repository: MetricSnapshotRepository) {}

  async getCampaignSnapshot(
    tenantId: string,
    metaCampaignId: string,
    window: MetricWindowKey,
  ): Promise<MetricSnapshotDto> {
    const dateRange = resolveWindowDateRange(window, new Date());
    const rows = await this.repository.getCampaignInsightRows(tenantId, metaCampaignId, dateRange);
    return this.buildSnapshot(window, rows);
  }

  async getAccountSnapshot(tenantId: string, window: MetricWindowKey): Promise<MetricSnapshotDto> {
    const dateRange = resolveWindowDateRange(window, new Date());
    const rows = await this.repository.getAccountInsightRows(tenantId, dateRange);
    return this.buildSnapshot(window, rows);
  }

  /**
   * EYVRA — SAMANTHA V2 Phase 7. Same real `meta_insights_daily` read `getCampaignSnapshot` uses,
   * but over an arbitrary CUSTOM `WindowDateRange` (a Growth Objective's own real
   * `[startDate, today]`, not one of `MetricWindowKey`'s fixed window keys) — used by
   * `GrowthObjectivesService.pacing` to sum real spend for one matched campaign. Reuses
   * `aggregateInsightRows` (never a parallel aggregation path).
   */
  async getCampaignSpendForRange(
    tenantId: string,
    metaCampaignId: string,
    range: WindowDateRange,
  ): Promise<RangeSpendResult> {
    const rows = await this.repository.getCampaignInsightRows(tenantId, metaCampaignId, range);
    return { spend: aggregateInsightRows(rows).spend, rowCount: rows.length };
  }

  /** Account-wide equivalent of `getCampaignSpendForRange` — see that method's doc. */
  async getAccountSpendForRange(
    tenantId: string,
    range: WindowDateRange,
  ): Promise<RangeSpendResult> {
    const rows = await this.repository.getAccountInsightRows(tenantId, range);
    return { spend: aggregateInsightRows(rows).spend, rowCount: rows.length };
  }

  private buildSnapshot(window: MetricWindowKey, rows: readonly InsightRow[]): MetricSnapshotDto {
    const aggregated = aggregateInsightRows(rows);
    const sampleSize = {
      impressions: aggregated.impressions,
      clicks: aggregated.clicks,
      leads: aggregated.leads,
    };
    // Distinct real dates present in the rows — NOT the window's nominal length. See
    // `MetricSnapshotDto.daysCovered`'s own doc for why this must stay honest.
    const daysCovered = new Set(rows.map((row) => row.date)).size;
    const dataSufficiency = assessDataSufficiency(sampleSize, daysCovered);

    return {
      window,
      ...aggregated,
      sampleSize,
      daysCovered,
      dataSufficiency,
    };
  }
}
