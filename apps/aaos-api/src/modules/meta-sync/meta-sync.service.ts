import { randomUUID } from "node:crypto";

import { AdAccountId, type DatePreset } from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";

import {
  buildSyncSnapshot,
  type CampaignDailyHistoryPoint,
  type SyncSnapshot,
} from "./domain/build-sync-snapshot.js";
import { MetaSyncRepository } from "./infrastructure/meta-sync.repository.js";

/** `YYYY-MM-DD` for a given real `Date`, in UTC (same convention `date DATE` columns elsewhere in this schema use — no timezone-local drift). */
function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yesterdayOf(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() - 1);
  return copy;
}

/**
 * `MetaSyncService` (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4). Real Meta campaign/adset/ad/
 * insights sync into Supabase (`meta_campaigns`/`meta_adsets`/`meta_ads`/`meta_insights_daily`,
 * `050_meta_sync.sql`), the previously-deferred Prompt 6.
 *
 * REAL HTTP-REUSE (not a new integration): every one of this service's 3 modes calls the SAME,
 * already-audited `connector.pullCampaignData.execute(...)` real Meta-reading call path every other
 * consumer in this app uses (`MetaAdsService.pullCampaigns`, `CampaignsService`'s own reads, etc.) —
 * resolved per-tenant via the real `MetaAdsConnectorRegistry.resolve(tenantId)` (Sprint 3's
 * OAuth-preferring/manual-fallback resolution), never a second, parallel Graph API client.
 *
 * REAL SCOPE DECISION — `syncCampaign` (realtime, per-action): `@aos/meta-ads-connector` has no
 * single-campaign-scoped pull (`PullCampaignData` always pulls the WHOLE ad account's campaign
 * tree — verified by reading its own `run()` implementation). Rather than add a second, narrower
 * Graph-calling code path this sprint would need to independently audit, `syncCampaign` reuses the
 * SAME whole-account pull (today's data) and then filters the resulting `SyncSnapshot` down to just
 * the one campaign whose id triggered the call before persisting — cheap (the tree is already in
 * memory) and honest (never persists stale data for OTHER campaigns as a side effect of one
 * campaign's own create/update action).
 */
@Injectable()
export class MetaSyncService {
  private readonly logger = new Logger(MetaSyncService.name);

  constructor(
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly repository: MetaSyncRepository,
  ) {}

  /**
   * Realtime, per-action sync — called right after Samantha creates/updates a real campaign
   * (`CampaignsService.createCampaign`/`.createPropertyCampaign`, `MetaAdsService.executeVerdict`).
   * ALWAYS best-effort: never throws. A sync failure here must never fail (or even delay past its
   * own real Meta round trip) the primary campaign action that triggered it — same "best-effort
   * side-effect, never blocks the primary action" discipline `AuditLogService.record`/
   * `ActivityLogger`/`indexPulledAdAccount` already establish in this codebase.
   */
  async syncCampaign(tenantId: string, metaCampaignId: string): Promise<void> {
    try {
      const connectorResult = await this.connectorRegistry.resolve(tenantId);
      if (!connectorResult.ok) {
        this.logger.warn(
          `MetaSyncService.syncCampaign: no connector for tenant "${tenantId}" — skipping best-effort sync for campaign ${metaCampaignId}.`,
        );
        return;
      }
      const connector = connectorResult.value;
      const rawAdAccountId = connector.adAccountIds[0];
      if (rawAdAccountId === undefined) {
        return;
      }
      const adAccountIdResult = AdAccountId.create(rawAdAccountId);
      if (!adAccountIdResult.ok) {
        return;
      }

      const now = new Date();
      const pulled = await connector.pullCampaignData.execute({
        adAccountId: adAccountIdResult.value,
        datePreset: "today",
        accessToken: connector.accessToken,
        tenantId,
        correlationId: randomUUID(),
      });
      if (!pulled.ok) {
        this.logger.warn(
          `MetaSyncService.syncCampaign: pull failed for tenant "${tenantId}", campaign ${metaCampaignId}: ${pulled.error.message}`,
        );
        return;
      }

      const fullSnapshot = buildSyncSnapshot(pulled.value, tenantId, toDateOnly(now));
      const filtered = filterSnapshotToCampaign(fullSnapshot, metaCampaignId);
      if (filtered.campaigns.length === 0) {
        // The just-created/just-updated campaign isn't in this pull yet (real Meta eventual
        // consistency — a brand-new campaign can take a few seconds to appear in a list read).
        // Honest no-op, not an error: the next 15-minute cron tick will pick it up.
        this.logger.log(
          `MetaSyncService.syncCampaign: campaign ${metaCampaignId} not yet visible in tenant "${tenantId}"'s pull — will be picked up by the next scheduled sync.`,
        );
        return;
      }
      await this.repository.upsertSnapshot(filtered);
    } catch (caught) {
      this.logger.warn(
        `MetaSyncService.syncCampaign: unexpected failure for tenant "${tenantId}", campaign ${metaCampaignId} — best-effort, swallowed: ${describeCause(caught)}`,
      );
    }
  }

  /**
   * 15-minute cadence — pulls today's real campaign/adset/ad insights for one tenant's default ad
   * account and upserts them under today's real `date`. THROWS on a real failure (pull error,
   * repository error, misconfigured connector) — the caller (`MetaSyncCronService`) is the real
   * per-tenant error-isolation boundary, same "inner unit throws, outer loop catches per item"
   * split `AccuracyCheckService.checkOne`/`MetaOAuthRefreshCronService`'s own `refreshTokenIfNeeded`
   * call already establish, so this method stays directly unit-testable for its own success/failure
   * paths without needing a cron tick.
   */
  async syncAllCampaignInsights(tenantId: string): Promise<void> {
    await this.syncOnce(tenantId, "today", new Date());
  }

  /**
   * Daily 00:05 snapshot — pulls the FULL PREVIOUS real calendar day's campaign/adset/ad insights
   * and persists one row per level/entity for THAT real date (`yesterday`'s `date_preset`, see
   * `PullCampaignData.ts`'s Sprint 4 additive widening). Same throw/per-tenant-catch-in-caller
   * contract as `syncAllCampaignInsights`.
   */
  async saveDailySnapshot(tenantId: string, referenceNow: Date = new Date()): Promise<void> {
    await this.syncOnce(tenantId, "yesterday", yesterdayOf(referenceNow));
  }

  /**
   * Campaign Page Rebuild v2 — real read-back of one campaign's `meta_insights_daily` history
   * (see `MetaSyncRepository.getCampaignDailyHistory`'s own doc). Thin pass-through — the real
   * work is the repository's tenant/campaign-scoped query.
   */
  async getCampaignHistory(
    tenantId: string,
    metaCampaignId: string,
    days: number,
  ): Promise<readonly CampaignDailyHistoryPoint[]> {
    return this.repository.getCampaignDailyHistory(tenantId, metaCampaignId, days);
  }

  /**
   * Campaign->Listing Mapping — real write path, called once by `CampaignsService.
   * createPropertyCampaign`'s real LIVE branch right after `syncCampaign` above (so the real
   * `meta_campaigns` row already exists). Thin pass-through — see `MetaSyncRepository.
   * linkCampaignListing`'s own doc for why this is a plain UPDATE, never an upsert with guessed
   * placeholder values.
   */
  async linkCampaignListing(
    tenantId: string,
    metaCampaignId: string,
    listingId: string,
  ): Promise<boolean> {
    return this.repository.linkCampaignListing(tenantId, metaCampaignId, listingId);
  }

  /**
   * Campaign->Listing Mapping — real read path for `GET /api/v1/campaigns/:campaignId/listing-id`.
   * Thin pass-through.
   */
  async getCampaignListingId(tenantId: string, metaCampaignId: string): Promise<string | null> {
    return this.repository.getCampaignListingId(tenantId, metaCampaignId);
  }

  private async syncOnce(tenantId: string, datePreset: DatePreset, dateFor: Date): Promise<void> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      // Not every tenant has a configured Meta connector yet — an honest, expected no-op, not a
      // real failure the per-tenant cron loop should count/log as an error.
      return;
    }
    const connector = connectorResult.value;
    const rawAdAccountId = connector.adAccountIds[0];
    if (rawAdAccountId === undefined) {
      return;
    }
    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const pulled = await connector.pullCampaignData.execute({
      adAccountId: adAccountIdResult.value,
      datePreset,
      accessToken: connector.accessToken,
      tenantId,
      correlationId: randomUUID(),
    });
    if (!pulled.ok) {
      throw pulled.error;
    }

    const snapshot = buildSyncSnapshot(pulled.value, tenantId, toDateOnly(dateFor));
    await this.repository.upsertSnapshot(snapshot);
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Real, pure filter — keeps only the one campaign (by real Meta id) and its own adsets/ads/insight rows. Exported for direct unit testing. */
export function filterSnapshotToCampaign(
  snapshot: SyncSnapshot,
  metaCampaignId: string,
): SyncSnapshot {
  const campaigns = snapshot.campaigns.filter((row) => row.metaCampaignId === metaCampaignId);
  const adSets = snapshot.adSets.filter((row) => row.metaCampaignId === metaCampaignId);
  const adSetMetaIds = new Set(adSets.map((row) => row.metaAdSetId));
  const ads = snapshot.ads.filter((row) => adSetMetaIds.has(row.metaAdSetId));
  const insights = snapshot.insights.filter((row) => row.metaCampaignId === metaCampaignId);
  return { campaigns, adSets, ads, insights };
}
