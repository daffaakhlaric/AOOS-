import type { SupabaseClientLike } from "@aos/lead-store";

import type {
  AdDimensionRow,
  AdSetDimensionRow,
  CampaignDailyHistoryPoint,
  CampaignDimensionRow,
  InsightRow,
  SyncSnapshot,
} from "../domain/build-sync-snapshot.js";

const CAMPAIGNS_TABLE = "meta_campaigns";
const ADSETS_TABLE = "meta_adsets";
const ADS_TABLE = "meta_ads";
const INSIGHTS_TABLE = "meta_insights_daily";

export class MetaSyncRepositoryError extends Error {}

/**
 * Same real `.upsert()` situation `AdTenantIndexRepository`/`WabaConfigRepository` already document
 * on themselves: the shared `SupabaseClientLike` port (`@aos/lead-store`'s `SupabaseTypes.ts`)
 * declares only `select`/`insert`/`update` — no `upsert`, no multi-column `.eq()` chain result
 * usable as a real conflict target. The REAL underlying client this port bridges to
 * (`@supabase/supabase-js`, via `infrastructure/supabase/SupabaseClient.ts`) genuinely has
 * `.upsert(values, { onConflict })`, so a narrow, file-local cast is the same established,
 * safe pattern `AdTenantIndexRepository.upsertMany` already uses for this exact real capability gap.
 */
interface UpsertableSupabaseClient {
  from(table: string): {
    upsert(
      values: ReadonlyArray<Record<string, unknown>>,
      options: { readonly onConflict: string },
    ): PromiseLike<{
      readonly data: ReadonlyArray<{ readonly id: string }> | null;
      readonly error: { readonly message: string } | null;
    }>;
  };
}

interface CampaignIdRow {
  readonly id: string;
  readonly meta_campaign_id: string;
}
interface AdSetIdRow {
  readonly id: string;
  readonly meta_adset_id: string;
}

/** Raw `meta_insights_daily` row shape as read back — real column names (snake_case), mapped to `CampaignDailyHistoryPoint`'s camelCase shape by `getCampaignDailyHistory`. */
interface InsightHistoryRow {
  readonly date: string;
  readonly spend: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly frequency: number;
  readonly ctr: number;
  readonly cpl: number;
  readonly leads: number;
}

/**
 * Supabase-backed persistence for `meta_campaigns`/`meta_adsets`/`meta_ads`/`meta_insights_daily`
 * (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — `050_meta_sync.sql`). One real, idempotent
 * `upsertSnapshot` call per real sync run (realtime/15-minute/daily) — every table is upserted on
 * its real UNIQUE constraint (see the migration's own header for the `meta_insights_daily`
 * `entity_ref_id` fix), so re-syncing the same tenant/window never creates duplicate rows, only
 * refreshes existing ones (`synced_at`/`updated_at` advance, real historical `date` rows accumulate
 * in `meta_insights_daily` as `date` itself advances across calls).
 *
 * Dimension tables are upserted BEFORE insights (campaigns -> adsets -> ads -> insights) so the real
 * FK chain (`meta_adsets.campaign_id`, `meta_ads.adset_id`, `meta_insights_daily.campaign_id/
 * adset_id/ad_id`) always resolves to a row that already exists by the time it's referenced — this
 * repository re-reads each dimension table's real, just-upserted `id`s (keyed by the real Meta id)
 * rather than trusting Supabase's `.upsert(...).select()` return order, which is not guaranteed to
 * match input order.
 */
export class MetaSyncRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  async upsertSnapshot(snapshot: SyncSnapshot): Promise<void> {
    const campaignIds = await this.upsertCampaigns(snapshot.campaigns);
    const adSetIds = await this.upsertAdSets(snapshot.adSets, campaignIds);
    await this.upsertAds(snapshot.ads, adSetIds);
    await this.upsertInsights(snapshot.insights, campaignIds, adSetIds);
  }

  /**
   * Campaign Page Rebuild v2 — real read-back of `meta_insights_daily` for ONE campaign, ordered
   * oldest-to-newest (the shape a sparkline/trend chart needs directly, no client-side re-sort).
   * `days` bounds how far back to look (a sparkline only ever needs the last ~7); an empty array is
   * a real, honest possible result — a campaign this app has never synced insights for (new
   * campaign, or `MetaSyncCronService` hasn't run yet since it started being tracked), never
   * fabricated placeholder points.
   */
  async getCampaignDailyHistory(
    tenantId: string,
    metaCampaignId: string,
    days: number,
  ): Promise<readonly CampaignDailyHistoryPoint[]> {
    const campaignResult = await this.client
      .from<CampaignIdRow>(CAMPAIGNS_TABLE)
      .select("id, meta_campaign_id")
      .eq("tenant_id", tenantId)
      .eq("meta_campaign_id", metaCampaignId)
      .maybeSingle();
    if (campaignResult.error !== null) {
      throw new MetaSyncRepositoryError(
        `MetaSyncRepository.getCampaignDailyHistory: campaign lookup failed: ${campaignResult.error.message}`,
      );
    }
    if (campaignResult.data === null) {
      return [];
    }

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(days - 1, 0));
    const sinceDate = since.toISOString().slice(0, 10);

    const { data, error } = await this.client
      .from<InsightHistoryRow>(INSIGHTS_TABLE)
      .select("date, spend, impressions, clicks, frequency, ctr, cpl, leads")
      .eq("tenant_id", tenantId)
      .eq("level", "campaign")
      .eq("campaign_id", campaignResult.data.id)
      .gte("date", sinceDate)
      .order("date", { ascending: true });
    if (error !== null) {
      throw new MetaSyncRepositoryError(
        `MetaSyncRepository.getCampaignDailyHistory: insights query failed: ${error.message}`,
      );
    }

    return (data ?? []).map((row) => ({
      date: row.date,
      spend: row.spend,
      impressions: row.impressions,
      clicks: row.clicks,
      frequency: row.frequency,
      ctr: row.ctr,
      cpl: row.cpl,
      leads: row.leads,
    }));
  }

  private upsertable(): UpsertableSupabaseClient {
    return this.client as unknown as UpsertableSupabaseClient;
  }

  /** Returns a real `metaCampaignId -> row UUID` map for every campaign just upserted. */
  private async upsertCampaigns(
    rows: readonly CampaignDimensionRow[],
  ): Promise<ReadonlyMap<string, string>> {
    if (rows.length === 0) {
      return new Map();
    }
    const now = new Date().toISOString();
    const values = rows.map((row) => ({
      tenant_id: row.tenantId,
      meta_campaign_id: row.metaCampaignId,
      name: row.name,
      status: row.status,
      objective: row.objective,
      spend: row.spend,
      meta_created_at: row.metaCreatedAt,
      synced_at: now,
      updated_at: now,
    }));
    const { error } = await this.upsertable()
      .from(CAMPAIGNS_TABLE)
      .upsert(values, { onConflict: "tenant_id,meta_campaign_id" });
    if (error !== null) {
      throw new MetaSyncRepositoryError(
        `MetaSyncRepository.upsertCampaigns failed: ${error.message}`,
      );
    }
    return this.reselectIds<CampaignIdRow>(
      CAMPAIGNS_TABLE,
      rows[0]?.tenantId ?? "",
      rows.map((row) => row.metaCampaignId),
      (row) => row.meta_campaign_id,
    );
  }

  private async upsertAdSets(
    rows: readonly AdSetDimensionRow[],
    campaignIds: ReadonlyMap<string, string>,
  ): Promise<ReadonlyMap<string, string>> {
    if (rows.length === 0) {
      return new Map();
    }
    const now = new Date().toISOString();
    const values = rows.flatMap((row) => {
      const campaignId = campaignIds.get(row.metaCampaignId);
      if (campaignId === undefined) {
        // Never happens on a real run (every adset's parent campaign is upserted first, in the
        // same snapshot) — skipped defensively rather than thrown, so one malformed row can never
        // abort the whole sync.
        return [];
      }
      return [
        {
          tenant_id: row.tenantId,
          campaign_id: campaignId,
          meta_adset_id: row.metaAdSetId,
          name: row.name,
          status: row.status,
          daily_budget: row.dailyBudget,
          spend: row.spend,
          audience_label: row.audienceLabel,
          synced_at: now,
          updated_at: now,
        },
      ];
    });
    if (values.length === 0) {
      return new Map();
    }
    const { error } = await this.upsertable()
      .from(ADSETS_TABLE)
      .upsert(values, { onConflict: "tenant_id,meta_adset_id" });
    if (error !== null) {
      throw new MetaSyncRepositoryError(`MetaSyncRepository.upsertAdSets failed: ${error.message}`);
    }
    return this.reselectIds<AdSetIdRow>(
      ADSETS_TABLE,
      rows[0]?.tenantId ?? "",
      rows.map((row) => row.metaAdSetId),
      (row) => row.meta_adset_id,
    );
  }

  private async upsertAds(
    rows: readonly AdDimensionRow[],
    adSetIds: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const values = rows.flatMap((row) => {
      const adSetId = adSetIds.get(row.metaAdSetId);
      if (adSetId === undefined) {
        return [];
      }
      return [
        {
          tenant_id: row.tenantId,
          adset_id: adSetId,
          meta_ad_id: row.metaAdId,
          name: row.name,
          status: row.status,
          stable_id: row.stableId,
          creative_kind: row.creativeKind,
          creative_ref: row.creativeRef,
          verdict: row.verdict,
          synced_at: now,
          updated_at: now,
        },
      ];
    });
    if (values.length === 0) {
      return;
    }
    const { error } = await this.upsertable()
      .from(ADS_TABLE)
      .upsert(values, { onConflict: "tenant_id,meta_ad_id" });
    if (error !== null) {
      throw new MetaSyncRepositoryError(`MetaSyncRepository.upsertAds failed: ${error.message}`);
    }
  }

  private async upsertInsights(
    rows: readonly InsightRow[],
    campaignIds: ReadonlyMap<string, string>,
    adSetIds: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    // Ad-level rows need their own real `meta_ads.id` — re-selected here (keyed by
    // `tenant_id`+`meta_ad_id`, the real UNIQUE constraint) exactly like campaigns/adsets above,
    // rather than threading a third id map through every call site.
    const adMetaIds = rows
      .filter((row) => row.metaAdId !== null)
      .map((row) => row.metaAdId as string);
    const adIds =
      adMetaIds.length > 0
        ? await this.reselectIds<{ readonly id: string; readonly meta_ad_id: string }>(
            ADS_TABLE,
            rows[0]?.tenantId ?? "",
            adMetaIds,
            (row) => row.meta_ad_id,
          )
        : new Map<string, string>();

    const values = rows.flatMap((row) => {
      const campaignId = campaignIds.get(row.metaCampaignId);
      if (campaignId === undefined) {
        return [];
      }
      const adSetId = row.metaAdSetId !== null ? adSetIds.get(row.metaAdSetId) : undefined;
      if (row.metaAdSetId !== null && adSetId === undefined) {
        return [];
      }
      const adId = row.metaAdId !== null ? adIds.get(row.metaAdId) : undefined;
      if (row.metaAdId !== null && adId === undefined) {
        return [];
      }
      return [
        {
          tenant_id: row.tenantId,
          level: row.level,
          campaign_id: campaignId,
          adset_id: adSetId ?? null,
          ad_id: adId ?? null,
          date: row.date,
          spend: row.metrics.spend,
          impressions: row.metrics.impressions,
          clicks: row.metrics.clicks,
          reach: row.metrics.reach,
          frequency: row.metrics.frequency,
          ctr: row.metrics.ctr,
          cpm: row.metrics.cpm,
          cpc: row.metrics.cpc,
          cpl: row.metrics.cpl,
          leads: row.metrics.leads,
          messaging_conversations: row.metrics.messagingConversations,
          actions: row.metrics.actions,
        },
      ];
    });
    if (values.length === 0) {
      return;
    }
    const { error } = await this.upsertable()
      .from(INSIGHTS_TABLE)
      .upsert(values, { onConflict: "tenant_id,level,entity_ref_id,date" });
    if (error !== null) {
      throw new MetaSyncRepositoryError(
        `MetaSyncRepository.upsertInsights failed: ${error.message}`,
      );
    }
  }

  /** Real re-select, keyed by the real Meta id column, batched via `.in(...)` is not available on the shared port either — this port has no `.in()` — so this selects the whole tenant's rows for that table and filters in-memory to the ids just upserted. Bounded by one tenant's real campaign/adset/ad count (never unbounded), same "small enough real dataset to read whole" assumption `TenantRepository.list()`/`AccuracyCheckService`'s batch caps already make elsewhere in this app. */
  private async reselectIds<Row extends { readonly id: string }>(
    table: string,
    tenantId: string,
    metaIds: readonly string[],
    metaIdOf: (row: Row) => string,
  ): Promise<ReadonlyMap<string, string>> {
    const wanted = new Set(metaIds);
    const { data, error } = await this.client
      .from<Row>(table)
      .select("*")
      .eq("tenant_id", tenantId);
    if (error !== null) {
      throw new MetaSyncRepositoryError(
        `MetaSyncRepository.reselectIds(${table}) failed: ${error.message}`,
      );
    }
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const metaId = metaIdOf(row);
      if (wanted.has(metaId)) {
        map.set(metaId, row.id);
      }
    }
    return map;
  }
}
