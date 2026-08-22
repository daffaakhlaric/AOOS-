import { randomUUID } from "node:crypto";

import { ALL_BRANCH_IDS } from "@aos/branch-manager";
import { ValidationError } from "@aos/errors";
import type { Lead, LeadStore } from "@aos/lead-store";
import { AdAccountId, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, LEAD_STORE, META_ADS_CONNECTOR } from "../../di-tokens.js";
import type { CalendarEventResult } from "../scheduler/domain/calendar-event.js";

import { lookalikeAudienceType, type StoredMetaAudience } from "./domain/meta-audience.js";
import { MetaAudienceRepository } from "./infrastructure/meta-audience.repository.js";

/** Meta's real minimum seed size before a Lookalike can be generated (spec's own "minimal 100 orang", verified 2026-08-21 against Meta's Marketing API "Lookalike Audiences" guide). */
export const MIN_AUDIENCE_SIZE_FOR_LOOKALIKE = 100;

const COUNTRY = "ID";

/**
 * Backs `/api/v1/lookalike/*` and the `LOOKALIKE_SYNC` Kalender handler (AAOS-ABTESTING-LOOKALIKE
 * Part 2). Single-tenant, exactly like every other service in this app (coordinator note section
 * 4) — every method operates on `this.config.AAOS_TENANT_ID`/the single composed
 * `MetaAdsConnector`/`META_AD_ACCOUNT_IDS[0]`, no per-tenant loop.
 *
 * Every Meta Custom Audience/Lookalike capability here goes through the genuinely new
 * `packages/meta-ads-connector` use cases built for this feature (coordinator note section 3) —
 * `createCustomAudience`/`addUsersToCustomAudience`/`createLookalikeAudience` — never a fabricated
 * client method.
 */
@Injectable()
export class LookalikeService {
  private readonly logger = new Logger(LookalikeService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
    @Inject(LEAD_STORE) private readonly leadStore: LeadStore,
    private readonly audienceRepository: MetaAudienceRepository,
    // `@Optional()` — see `AbTestingService`'s own `now` param doc; a bare `Function`-typed
    // constructor param with only a default value still gets a real DI resolution attempt from
    // Nest without this, crashing bootstrap.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  private get tenantId(): string {
    return this.config.AAOS_TENANT_ID;
  }

  // ---------------------------------------------------------------------------------------------
  // `GET /api/v1/lookalike/status` — the spec's "Hot Leads Database" status card.
  // ---------------------------------------------------------------------------------------------

  async getStatus(): Promise<{
    readonly totalHotLeads: number;
    readonly syncedToMetaAudience: number;
    readonly minRequiredForLookalike: number;
    readonly progressPercentage: number;
    readonly lookalikeEligible: boolean;
    readonly lastSyncedAt: string | undefined;
    readonly customAudience: StoredMetaAudience | undefined;
  }> {
    const hotLeads = await this.allHotLeads();
    const synced = hotLeads.filter((lead) => lead.syncedToMetaAudience);
    const lastSyncedAt = synced.reduce<Date | undefined>((latest, lead) => {
      if (lead.syncedAt === undefined) {
        return latest;
      }
      return latest === undefined || lead.syncedAt.getTime() > latest.getTime()
        ? lead.syncedAt
        : latest;
    }, undefined);
    const customAudience = await this.audienceRepository.findByTenantAndType(
      this.tenantId,
      "HOT_LEADS",
    );
    const total = hotLeads.length;
    const progressPercentage = Math.min(
      100,
      Math.round((total / MIN_AUDIENCE_SIZE_FOR_LOOKALIKE) * 100),
    );
    return {
      totalHotLeads: total,
      syncedToMetaAudience: synced.length,
      minRequiredForLookalike: MIN_AUDIENCE_SIZE_FOR_LOOKALIKE,
      progressPercentage,
      lookalikeEligible: total >= MIN_AUDIENCE_SIZE_FOR_LOOKALIKE,
      lastSyncedAt: lastSyncedAt?.toISOString(),
      customAudience,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // `GET /api/v1/lookalike/audiences` — the spec's Custom Audience + Lookalike list.
  // ---------------------------------------------------------------------------------------------

  async listAudiences(): Promise<readonly StoredMetaAudience[]> {
    return this.audienceRepository.listByTenant(this.tenantId);
  }

  // ---------------------------------------------------------------------------------------------
  // `POST /api/v1/lookalike/sync` + `LOOKALIKE_SYNC` Kalender handler — spec's `syncHotLeadsToMeta`.
  // ---------------------------------------------------------------------------------------------

  async runLookalikeSync(): Promise<CalendarEventResult> {
    const result = await this.syncHotLeadsToMeta();
    return {
      summary: result.summary,
      newlySynced: result.newlySynced,
      totalSynced: result.totalSynced,
    };
  }

  async syncHotLeadsToMeta(): Promise<{
    readonly summary: string;
    readonly newlySynced: number;
    readonly totalSynced: number;
    readonly customAudience: StoredMetaAudience | undefined;
  }> {
    const hotLeads = await this.allHotLeads();
    const unsynced = hotLeads.filter((lead) => !lead.syncedToMetaAudience);

    if (unsynced.length === 0) {
      const existing = await this.audienceRepository.findByTenantAndType(
        this.tenantId,
        "HOT_LEADS",
      );
      return {
        summary: "0 hot leads baru untuk disync",
        newlySynced: 0,
        totalSynced: hotLeads.filter((lead) => lead.syncedToMetaAudience).length,
        customAudience: existing,
      };
    }

    const audience = await this.getOrCreateCustomAudience();
    const accessToken = this.config.META_ACCESS_TOKEN;

    const uploadResult = await this.connector.addUsersToCustomAudience.execute({
      customAudienceId: audience.metaAudienceId,
      phones: unsynced.map((lead) => lead.leadPhone.toString()),
      accessToken,
    });
    if (!uploadResult.ok) {
      this.logger.warn(
        `LookalikeService.syncHotLeadsToMeta: upload failed: ${uploadResult.error.message}`,
      );
      throw new Error(uploadResult.error.message);
    }

    const nowIso = this.now().toISOString();
    for (const lead of unsynced) {
      const markResult = await this.leadStore.markLeadSyncedToMetaAudience.execute({
        leadId: lead.id.toString(),
      });
      if (!markResult.ok) {
        this.logger.warn(
          `LookalikeService.syncHotLeadsToMeta: markLeadSyncedToMetaAudience failed for ${lead.id.toString()}: ${markResult.error.message}`,
        );
      }
    }

    const totalSynced =
      hotLeads.filter((lead) => lead.syncedToMetaAudience).length + unsynced.length;
    await this.audienceRepository.updateSize(audience.id, totalSynced, nowIso);

    return {
      summary: `${String(unsynced.length)} hot leads baru disync ke Meta Custom Audience`,
      newlySynced: unsynced.length,
      totalSynced,
      customAudience: { ...audience, size: totalSynced, lastUpdatedAt: nowIso },
    };
  }

  // ---------------------------------------------------------------------------------------------
  // `POST /api/v1/lookalike/audiences/lookalike` — spec's `createLookalike`.
  // ---------------------------------------------------------------------------------------------

  async createLookalike(percentage: 1 | 2 | 3): Promise<StoredMetaAudience> {
    const origin = await this.audienceRepository.findByTenantAndType(this.tenantId, "HOT_LEADS");
    if (origin === undefined) {
      throw new ValidationError(
        "Belum ada Custom Audience hot leads — jalankan Sync Hot Leads ke Meta dulu.",
      );
    }

    const audienceType = lookalikeAudienceType(percentage);
    const existing = await this.audienceRepository.findByTenantAndType(this.tenantId, audienceType);
    if (existing !== undefined) {
      return existing;
    }

    const adAccountIdResult = AdAccountId.create(this.requireAdAccountId());
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const result = await this.connector.createLookalikeAudience.execute({
      adAccountId: adAccountIdResult.value,
      name: `AAOS-Lookalike-${String(percentage)}pct-${this.tenantId}`,
      originAudienceId: origin.metaAudienceId,
      percentage,
      country: COUNTRY,
      accessToken: this.config.META_ACCESS_TOKEN,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return this.audienceRepository.create({
      id: randomUUID(),
      tenantId: this.tenantId,
      metaAudienceId: result.value.audienceId,
      audienceType,
      name: `AAOS-Lookalike-${String(percentage)}pct-${this.tenantId}`,
      originAudienceId: origin.metaAudienceId,
      percentage,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Internals.
  // ---------------------------------------------------------------------------------------------

  /** Every real HOT-status lead across every branch (mirrors `SchedulerService.countHotLeads`'s per-branch aggregation — `@aos/lead-store`'s `GetHotLeads` has no tenant-wide aggregate use case). A branch whose lookup fails contributes nothing and is logged, never aborts the whole sync. */
  private async allHotLeads(): Promise<readonly Lead[]> {
    const leads: Lead[] = [];
    for (const branchId of ALL_BRANCH_IDS) {
      const result = await this.leadStore.getHotLeads.execute(branchId);
      if (result.ok) {
        leads.push(...result.value);
      } else {
        this.logger.warn(
          `LookalikeService.allHotLeads: getHotLeads(${branchId}) failed: ${result.error.message}`,
        );
      }
    }
    return leads;
  }

  private async getOrCreateCustomAudience(): Promise<StoredMetaAudience> {
    const existing = await this.audienceRepository.findByTenantAndType(this.tenantId, "HOT_LEADS");
    if (existing !== undefined) {
      return existing;
    }

    const adAccountIdResult = AdAccountId.create(this.requireAdAccountId());
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const monthYear = formatMonthYear(this.now());
    const result = await this.connector.createCustomAudience.execute({
      adAccountId: adAccountIdResult.value,
      name: `AAOS-HotLeads-${this.tenantId}-${monthYear}`,
      description: "Hot leads dari AAOS Jessy AI (score >= 65)",
      accessToken: this.config.META_ACCESS_TOKEN,
    });
    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return this.audienceRepository.create({
      id: randomUUID(),
      tenantId: this.tenantId,
      metaAudienceId: result.value.audienceId,
      audienceType: "HOT_LEADS",
      name: `AAOS-HotLeads-${this.tenantId}-${monthYear}`,
    });
  }

  private requireAdAccountId(): string {
    const id = this.config.META_AD_ACCOUNT_IDS[0];
    if (id === undefined) {
      throw new ValidationError("No META_AD_ACCOUNT_IDS configured");
    }
    return id;
  }
}

/** `MMMyyyy`-ish month tag for the Custom Audience name (spec's `format(new Date(), 'MMMyyy')`), e.g. "Aug2026". */
function formatMonthYear(date: Date): string {
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month}${String(date.getUTCFullYear())}`;
}
