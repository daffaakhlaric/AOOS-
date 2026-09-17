import type { SupabaseClientLike } from "@aos/lead-store";

import type { WindowDateRange } from "../../metric-snapshot/domain/metric-window.js";
import type { InsightRow } from "../../metric-snapshot/infrastructure/metric-snapshot.repository.js";

const CREATIVE_PACKAGES_TABLE = "creative_packages";
const META_ADS_TABLE = "meta_ads";
const INSIGHTS_TABLE = "meta_insights_daily";

export class CreativeMemoryRepositoryError extends Error {}

/** Raw `creative_packages` columns this module reads — the subset `angle-performance.ts` and its DTO need, not a second full row shape (`CreativePackageRepository`'s own `CreativePackageRow` remains the authoritative full-row type for that module). */
interface CreativePackageQueryRow {
  readonly id: string;
  readonly angle: string;
  readonly published_meta_ad_ids: readonly string[] | null;
  readonly fatigue_status: string;
  readonly generated_at: string | null;
}

export interface PublishedPackageRow {
  readonly id: string;
  readonly angle: string;
  readonly publishedMetaAdIds: readonly string[];
  readonly fatigueStatus: string;
  readonly generatedAt: string | null;
}

interface MetaAdIdRow {
  readonly id: string;
  readonly meta_ad_id: string;
}

const CREATIVE_PACKAGE_COLUMNS = "id, angle, published_meta_ad_ids, fatigue_status, generated_at";
const INSIGHT_COLUMNS = "date, spend, impressions, clicks, reach, leads";

/**
 * Minimal structural subset of `@aos/lead-store`'s real `SupabaseFilterBuilderLike<Row>` this file
 * needs for a conditional date-range filter — same reason and same shape
 * `metric-snapshot.repository.ts`'s own `DateRangeFilterable` exists (that type isn't exported from
 * the package's public `index.ts`, only `SupabaseClientLike` is).
 */
interface DateRangeFilterable<Row> extends PromiseLike<{
  readonly data: readonly Row[] | null;
  readonly error: { readonly message: string } | null;
}> {
  gte(column: string, value: unknown): DateRangeFilterable<Row>;
  lte(column: string, value: unknown): DateRangeFilterable<Row>;
}

/**
 * Supabase-backed reads for EYVRA — SAMANTHA V2 + KAI V2 Phase 2's Creative Performance Memory —
 * a NEW, additive, PURE-READ module joining `creative_packages.published_meta_ad_ids` through
 * `meta_ads`/`meta_insights_daily` (real Meta ad performance, `050_meta_sync.sql`). Every method is
 * `tenant_id`-scoped, same discipline `MetricSnapshotRepository`/`CreativePackageRepository`
 * establish. Deliberately queries these tables directly with its own repository rather than
 * injecting `CreativePackagesService`/`CreativePackageRepository` — that service is tenant-scoped
 * via the older static `AAOS_TENANT_ID` config value, not this newer per-request `@TenantId()`
 * convention (see this module's `.module.ts` doc for the same note at the composition root).
 *
 * Never writes to `creative_packages`, `meta_ads`, or `meta_insights_daily` — read-only by
 * construction (no `insert`/`update`/`delete` call anywhere in this file).
 */
export class CreativeMemoryRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Every real, published (non-empty `published_meta_ad_ids`) PROPERTY `creative_packages` row for
   * this tenant. The shared `SupabaseClientLike` port has no `.not()`/`.is()` capability (same real
   * limitation `MetricSnapshotRepository.countAutoLoopSince`'s own doc flags for `.count()`), so
   * "published, non-empty" is filtered here in application code after a plain `.eq(...)` read,
   * rather than at the query layer.
   */
  async listPublishedPropertyPackages(tenantId: string): Promise<readonly PublishedPackageRow[]> {
    const { data, error } = await this.client
      .from<CreativePackageQueryRow>(CREATIVE_PACKAGES_TABLE)
      .select(CREATIVE_PACKAGE_COLUMNS)
      .eq("tenant_id", tenantId)
      .eq("vertical", "PROPERTY");
    if (error !== null) {
      throw new CreativeMemoryRepositoryError(
        `CreativeMemoryRepository.listPublishedPropertyPackages failed: ${error.message}`,
      );
    }
    return (data ?? [])
      .filter((row) => row.published_meta_ad_ids !== null && row.published_meta_ad_ids.length > 0)
      .map((row) => ({
        id: row.id,
        angle: row.angle,
        publishedMetaAdIds: row.published_meta_ad_ids ?? [],
        fatigueStatus: row.fatigue_status,
        generatedAt: row.generated_at,
      }));
  }

  /**
   * Resolves each real `meta_ad_id` to its internal `meta_ads.id` (tenant-scoped), then reads that
   * ad's real `meta_insights_daily` rows (`level='ad'`), within `dateRange` when given (omitted
   * entirely for lifetime, same convention `MetricSnapshotRepository.applyDateRange` establishes).
   * A `meta_ad_id` never synced into `meta_ads` yet (edge case: published, but the periodic sync
   * hasn't run) is silently skipped — same honest "no fabricated row" precedent
   * `MetricSnapshotRepository` already sets, not an error.
   *
   * Looped per `meta_ad_id` (no `.in()` capability on the shared `SupabaseClientLike` port either).
   * N+1 across a package's own small number of published ad ids, and across this module's own
   * small number of published packages, is an accepted MVP-scale tradeoff at this phase's real
   * current data volume — documented here rather than building a batched `.in()` capability this
   * port doesn't otherwise need yet.
   */
  async getAdInsightRows(
    tenantId: string,
    metaAdIds: readonly string[],
    dateRange?: WindowDateRange,
  ): Promise<readonly InsightRow[]> {
    const rows: InsightRow[] = [];
    for (const metaAdId of metaAdIds) {
      const adResult = await this.client
        .from<MetaAdIdRow>(META_ADS_TABLE)
        .select("id, meta_ad_id")
        .eq("tenant_id", tenantId)
        .eq("meta_ad_id", metaAdId)
        .maybeSingle();
      if (adResult.error !== null) {
        throw new CreativeMemoryRepositoryError(
          `CreativeMemoryRepository.getAdInsightRows: ad lookup failed for ${metaAdId}: ${adResult.error.message}`,
        );
      }
      if (adResult.data === null) {
        continue;
      }

      let query: DateRangeFilterable<InsightRow> = this.client
        .from<InsightRow>(INSIGHTS_TABLE)
        .select(INSIGHT_COLUMNS)
        .eq("tenant_id", tenantId)
        .eq("level", "ad")
        .eq("ad_id", adResult.data.id);
      if (dateRange !== undefined) {
        query = query.gte("date", dateRange.start).lte("date", dateRange.end);
      }

      const { data, error } = await query;
      if (error !== null) {
        throw new CreativeMemoryRepositoryError(
          `CreativeMemoryRepository.getAdInsightRows: insights query failed for ${metaAdId}: ${error.message}`,
        );
      }
      rows.push(...(data ?? []));
    }
    return rows;
  }
}
