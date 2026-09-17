import type { SupabaseClientLike } from "@aos/lead-store";

import type { WindowDateRange } from "../domain/metric-window.js";

const CAMPAIGNS_TABLE = "meta_campaigns";
const INSIGHTS_TABLE = "meta_insights_daily";

export class MetricSnapshotRepositoryError extends Error {}

interface CampaignIdRow {
  readonly id: string;
  readonly meta_campaign_id: string;
}

/**
 * Minimal structural subset of `@aos/lead-store`'s real `SupabaseFilterBuilderLike<Row>` this file
 * needs (`.gte`/`.lte` + awaitable) — that type itself isn't exported from the package's public
 * `index.ts` (only `SupabaseClientLike` is), so this local shape is declared here instead of
 * reaching into the package's internal module path. Every real query object this repository builds
 * structurally satisfies it (a real superset with `.select`/`.eq`/etc. too).
 */
interface DateRangeFilterable<Row> extends PromiseLike<{
  readonly data: readonly Row[] | null;
  readonly error: { readonly message: string } | null;
}> {
  gte(column: string, value: unknown): DateRangeFilterable<Row>;
  lte(column: string, value: unknown): DateRangeFilterable<Row>;
}

/** Raw `meta_insights_daily` row shape this repository reads — just the counters `domain/aggregate-insights.ts` sums, plus `date` for `MetricSnapshotService`'s `daysCovered` count. */
export interface InsightRow {
  readonly date: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly reach: number;
  readonly leads: number;
}

const INSIGHT_COLUMNS = "date, spend, impressions, clicks, reach, leads";

/**
 * Supabase-backed reads over `meta_campaigns`/`meta_insights_daily` (`050_meta_sync.sql`) for
 * EYVRA — SAMANTHA V2 Phase 1 Part B's Metric Snapshot domain. Every method is explicitly
 * tenant-scoped via `.eq("tenant_id", tenantId)`, same discipline `GrowthObjectiveRepository`/
 * `MetaSyncRepository` already establish — never relying on RLS alone at this layer.
 *
 * Both methods return `[]` honestly when nothing has been synced yet — never a fabricated row —
 * same precedent `MetaSyncRepository.getCampaignDailyHistory` already sets for reading this exact
 * table.
 */
export class MetricSnapshotRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Resolves the real `meta_campaigns.id` from the given `meta_campaign_id` first (mirrors
   * `MetaSyncRepository.getCampaignDailyHistory`'s existing lookup), then reads
   * `meta_insights_daily` filtered to `level='campaign'` + that campaign's internal id + the given
   * `dateRange` (all real synced rows, unbounded, for `dateRange === undefined` — `"lifetime"`).
   */
  async getCampaignInsightRows(
    tenantId: string,
    metaCampaignId: string,
    dateRange: WindowDateRange | undefined,
  ): Promise<readonly InsightRow[]> {
    const campaignResult = await this.client
      .from<CampaignIdRow>(CAMPAIGNS_TABLE)
      .select("id, meta_campaign_id")
      .eq("tenant_id", tenantId)
      .eq("meta_campaign_id", metaCampaignId)
      .maybeSingle();
    if (campaignResult.error !== null) {
      throw new MetricSnapshotRepositoryError(
        `MetricSnapshotRepository.getCampaignInsightRows: campaign lookup failed: ${campaignResult.error.message}`,
      );
    }
    if (campaignResult.data === null) {
      return [];
    }

    let query: DateRangeFilterable<InsightRow> = this.client
      .from<InsightRow>(INSIGHTS_TABLE)
      .select(INSIGHT_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("level", "campaign")
      .eq("campaign_id", campaignResult.data.id);
    query = this.applyDateRange(query, dateRange);

    const { data, error } = await query;
    if (error !== null) {
      throw new MetricSnapshotRepositoryError(
        `MetricSnapshotRepository.getCampaignInsightRows: insights query failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /**
   * Account-wide (every real campaign for this tenant, no `campaign_id` filter) equivalent of
   * `getCampaignInsightRows` — no existing precedent in this codebase before this phase; same
   * tenant-scoping discipline, same `level='campaign'` filter (this table's campaign-level rows,
   * not adset/ad-level, to avoid triple-counting the same spend/impressions at every level).
   */
  async getAccountInsightRows(
    tenantId: string,
    dateRange: WindowDateRange | undefined,
  ): Promise<readonly InsightRow[]> {
    let query: DateRangeFilterable<InsightRow> = this.client
      .from<InsightRow>(INSIGHTS_TABLE)
      .select(INSIGHT_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("level", "campaign");
    query = this.applyDateRange(query, dateRange);

    const { data, error } = await query;
    if (error !== null) {
      throw new MetricSnapshotRepositoryError(
        `MetricSnapshotRepository.getAccountInsightRows: insights query failed: ${error.message}`,
      );
    }
    return data ?? [];
  }

  /** `dateRange === undefined` ("lifetime") omits both bounds entirely rather than applying a fabricated wide range. */
  private applyDateRange(
    query: DateRangeFilterable<InsightRow>,
    dateRange: WindowDateRange | undefined,
  ): DateRangeFilterable<InsightRow> {
    if (dateRange === undefined) {
      return query;
    }
    return query.gte("date", dateRange.start).lte("date", dateRange.end);
  }
}
