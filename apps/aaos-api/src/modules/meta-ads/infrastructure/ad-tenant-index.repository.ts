import type { SupabaseClientLike } from "@aos/lead-store";
import { createLogger, type Logger } from "@aos/logger";
import type { AdAccount } from "@aos/meta-ads-connector";

const TABLE = "ad_tenant_index";

/** Raw `ad_tenant_index` row shape (snake_case) — COLUMN-FOR-COLUMN with `supabase/migrations/018_ad_tenant_index.sql`. */
export interface AdTenantIndexRow {
  readonly ad_meta_id: string;
  readonly tenant_id: string;
  readonly ad_account_id: string;
  readonly updated_at: string;
}

export interface AdTenantIndexEntry {
  readonly adMetaId: string;
  readonly tenantId: string;
  readonly adAccountId: string;
}

export class AdTenantIndexRepositoryError extends Error {}

/**
 * Same `.upsert()` situation as `modules/settings/infrastructure/waba-config.repository.ts`'s own
 * `.delete()` workaround: the shared `SupabaseClientLike` port (`@aos/lead-store`'s
 * `SupabaseTypes.ts`) declares only `select`/`insert`/`update` — no `upsert`. The REAL underlying
 * client `createSupabaseClient` bridges to that port genuinely has `.upsert(...)` (real
 * `@supabase/supabase-js`), so a narrow, file-local cast here is the established, safe pattern for
 * the one real Supabase capability this repository needs that the shared port doesn't declare.
 */
interface UpsertableSupabaseClient {
  from(table: string): {
    upsert(
      values: ReadonlyArray<Record<string, unknown>>,
      options: { readonly onConflict: string },
    ): PromiseLike<{ readonly error: { readonly message: string } | null }>;
  };
}

/**
 * Supabase-backed persistence for `ad_tenant_index` (AAOS-MULTI-TENANT-PHASE1C) — the real,
 * durable, tenant-keyed index from a raw Meta `ad.metaId` to the tenant that owns it. Populated by
 * `indexPulledAdAccount` (this file) right after each of this app's 4 real pull call sites
 * succeeds; consulted by `WebhookService.resolveTenantId` to route an inbound Meta lead webhook to
 * its real owning tenant BEFORE picking a connector.
 */
export class AdTenantIndexRepository {
  constructor(private readonly client: SupabaseClientLike) {}

  /**
   * Idempotent, batched upsert on `ad_meta_id` (conflict target) — a real Meta ad only ever
   * belongs to one tenant/ad account, so a re-pull refreshes rather than duplicates. Callers
   * (`indexPulledAdAccount`) MUST NOT let a failure here propagate as a pull failure — indexing is
   * a best-effort side effect, not a correctness requirement for the pull itself.
   */
  async upsertMany(entries: ReadonlyArray<AdTenantIndexEntry>): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    const now = new Date().toISOString();
    const values = entries.map((entry) => ({
      ad_meta_id: entry.adMetaId,
      tenant_id: entry.tenantId,
      ad_account_id: entry.adAccountId,
      updated_at: now,
    }));
    const client = this.client as unknown as UpsertableSupabaseClient;
    const { error } = await client.from(TABLE).upsert(values, { onConflict: "ad_meta_id" });
    if (error !== null) {
      throw new AdTenantIndexRepositoryError(
        `AdTenantIndexRepository.upsertMany failed: ${error.message}`,
      );
    }
  }

  /** The real lookup `WebhookService.resolveTenantId` needs: which tenant owns this raw Meta ad id. */
  async findTenantByAdMetaId(adMetaId: string): Promise<string | undefined> {
    const { data, error } = await this.client
      .from<AdTenantIndexRow>(TABLE)
      .select("*")
      .eq("ad_meta_id", adMetaId)
      .maybeSingle();
    if (error !== null) {
      throw new AdTenantIndexRepositoryError(
        `AdTenantIndexRepository.findTenantByAdMetaId failed: ${error.message}`,
      );
    }
    return data?.tenant_id ?? undefined;
  }
}

const indexLogger: Logger = createLogger({ serviceName: "ad-tenant-index" });

/**
 * Walks a pulled `AdAccount`'s `campaigns[].adSets[].ads[]` — the exact same real shape
 * `AdAccountRegistry.save` (`packages/meta-ads-connector/src/registry/AdAccountRegistry.ts`)
 * already walks to build its own in-memory index — and upserts one `{ad.metaId, tenantId,
 * adAccountId}` triple per ad into `AdTenantIndexRepository`. Called from all 4 real pull call
 * sites (scheduler.service.ts/meta-ads.service.ts/intelligence.service.ts/abtesting.service.ts)
 * right after each one's existing success path, using the tenantId already in scope there.
 *
 * NEVER throws/rejects the caller — logs a warning and returns, whether the failure is in the walk
 * itself (a malformed/partial `AdAccount`) or in the repository write. Indexing is a best-effort
 * side effect of a successful pull, not a correctness requirement for the pull itself (mirrors
 * this repository's own `upsertMany` doc).
 */
export async function indexPulledAdAccount(
  repository: AdTenantIndexRepository,
  tenantId: string,
  adAccount: AdAccount,
): Promise<void> {
  try {
    const adAccountId = adAccount.id.toString();
    const entries: AdTenantIndexEntry[] = [];
    for (const campaign of adAccount.campaigns) {
      for (const adSet of campaign.adSets) {
        for (const ad of adSet.ads) {
          entries.push({ adMetaId: ad.metaId, tenantId, adAccountId });
        }
      }
    }
    await repository.upsertMany(entries);
  } catch (error) {
    indexLogger.warn(
      { tenantId, error: error instanceof Error ? error.message : String(error) },
      "indexPulledAdAccount: ad_tenant_index upsert failed — continuing, indexing is best-effort",
    );
  }
}
