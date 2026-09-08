import { ConflictError, NotFoundError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import type { AdAccountResponseDto } from "../meta-ads/dto/campaign-response.dto.js";
import type { MetaAdsService } from "../meta-ads/meta-ads.service.js";

import type { PropertyObjectiveRow } from "./dto/property-objective.dto.js";
import { PropertyObjectiveRepository } from "./property-objective.repository.js";
import { PropertyObjectiveService } from "./property-objective.service.js";

const FIXED_NOW = new Date("2026-09-01T12:00:00.000Z");
const TENANT_ID = "property-tenant-1";
const CORRELATION_ID = "corr-1";

function seedObjective(
  client: ReturnType<typeof createFakeSupabaseClient>,
  overrides: Partial<PropertyObjectiveRow> = {},
): void {
  client.seed("property_objectives", {
    id: "obj-1",
    tenant_id: TENANT_ID,
    period_month: 9,
    period_year: 2026,
    target_hot_leads: 20,
    budget_allocation: 5_000_000,
    budget_source: "MANUAL",
    focus_listings: ["The Green Residence"],
    area_priorities: ["Jakarta Selatan"],
    status: "DRAFT",
    created_at: "2026-09-01T00:00:00.000Z",
    activated_at: null,
    completed_at: null,
    avg_deal_value: null,
    target_cpl: null,
    breakeven_cpl: null,
    updated_by: null,
    updated_at: null,
    max_auto_briefs_per_day: 5,
    auto_approve_creative_brief: false,
    auto_publish_campaign: false,
    max_budget_increase_pct: 20,
    ...overrides,
  });
}

function buildAdAccount(rphLeadValues: readonly (number | null)[]): AdAccountResponseDto {
  return {
    id: "act_1",
    name: "Test Account",
    businessManagerId: "bm-1",
    currency: "IDR",
    timezone: "Asia/Jakarta",
    syncedAt: "2026-09-01T00:00:00.000Z",
    campaigns: [
      {
        id: "c-1",
        stableId: "c-1",
        metaId: "m-1",
        name: "Campaign 1",
        objective: "OUTCOME_LEADS",
        status: "ACTIVE",
        funnel: "MAAO2",
        branch: "BINTARO",
        spend: 500_000,
        createdAt: "2026-09-01T00:00:00.000Z",
        adSets: [
          {
            id: "as-1",
            stableId: "as-1",
            metaId: "mas-1",
            name: "AdSet 1",
            status: "ACTIVE",
            branch: "BINTARO",
            dailyBudget: 100_000,
            spend: 100_000,
            ads: rphLeadValues.map((rphLead, index) => ({
              id: `ad-${String(index)}`,
              stableId: `ad-${String(index)}`,
              metaId: `mad-${String(index)}`,
              name: `Ad ${String(index)}`,
              status: "ACTIVE",
              funnel: "MAAO2",
              branch: "BINTARO",
              verdict: "KEEP",
              metrics: {
                spend: 100_000,
                impressions: 1000,
                reach: 900,
                frequency: 1.1,
                clicks: 50,
                conversations: 10,
                d2: 2,
                d3: 3,
                d5: 5,
                leadForm: 4,
                totalLead: 4,
                rphChat: null,
                rphD3: null,
                rphLead,
              },
              createdAt: "2026-09-01T00:00:00.000Z",
              daysSinceCreation: 1,
            })),
          },
        ],
      },
    ],
  };
}

function buildService(
  client: ReturnType<typeof createFakeSupabaseClient>,
  pullCampaignsImpl?: () => Promise<AdAccountResponseDto>,
): { service: PropertyObjectiveService; metaAdsService: MetaAdsService } {
  const repository = new PropertyObjectiveRepository(client);
  const pullCampaigns = vi.fn(
    pullCampaignsImpl ?? (async () => buildAdAccount([100_000, 200_000])),
  );
  const metaAdsService = { pullCampaigns } as unknown as MetaAdsService;
  const service = new PropertyObjectiveService(repository, metaAdsService, () => FIXED_NOW);
  return { service, metaAdsService };
}

describe("PropertyObjectiveService", () => {
  describe("create", () => {
    it("persists a real DRAFT row for the current real period", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      const result = await service.create(TENANT_ID, {
        targetHotLeads: 20,
        budgetAllocation: 5_000_000,
        budgetSource: "MANUAL",
        focusListings: ["The Green Residence"],
        areaPriorities: ["Jakarta Selatan"],
      });

      expect(result.status).toBe("DRAFT");
      expect(result.period).toEqual({ month: 9, year: 2026 });
      expect(result.budgetAllocation).toBe(5_000_000);
      expect(result.budgetSource).toBe("MANUAL");
      expect(result.focusListings).toEqual(["The Green Residence"]);
      expect(result.areaPriorities).toEqual(["Jakarta Selatan"]);
    });

    it("throws ConflictError when the tenant already has an active/draft objective this period", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { status: "DRAFT" });
      const { service } = buildService(client);

      await expect(
        service.create(TENANT_ID, {
          targetHotLeads: 20,
          budgetAllocation: 5_000_000,
          budgetSource: "MANUAL",
          focusListings: ["Unit B"],
          areaPriorities: ["Bandung"],
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("allows a new objective when the existing one for this period is COMPLETED (not blocking)", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { status: "COMPLETED" });
      const { service } = buildService(client);

      const result = await service.create(TENANT_ID, {
        targetHotLeads: 30,
        budgetAllocation: 7_000_000,
        budgetSource: "MANUAL",
        focusListings: ["Unit C"],
        areaPriorities: ["Surabaya"],
      });
      expect(result.status).toBe("DRAFT");
    });

    it("never blocks on a different tenant's active objective for the same period (real tenant scoping)", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { tenant_id: "other-tenant", status: "ACTIVE" });
      const { service } = buildService(client);

      const result = await service.create(TENANT_ID, {
        targetHotLeads: 30,
        budgetAllocation: 7_000_000,
        budgetSource: "MANUAL",
        focusListings: ["Unit C"],
        areaPriorities: ["Surabaya"],
      });
      expect(result.status).toBe("DRAFT");
    });
  });

  describe("get", () => {
    it("returns the current real DRAFT/ACTIVE objective for the tenant's current period", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client);
      const { service } = buildService(client);

      const result = await service.get(TENANT_ID);
      expect(result.id).toBe("obj-1");
    });

    it("throws NotFoundError when the tenant has no objective for the current period", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);
      await expect(service.get(TENANT_ID)).rejects.toThrow(NotFoundError);
    });

    it("never returns a different tenant's objective (real tenant scoping)", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { tenant_id: "other-tenant" });
      const { service } = buildService(client);
      await expect(service.get(TENANT_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe("getBudgetSuggestion", () => {
    it("computes suggestedBudget = targetHotLeads * portfolio average CPL from the real Meta pull", async () => {
      const client = createFakeSupabaseClient();
      const { service, metaAdsService } = buildService(client, async () =>
        buildAdAccount([100_000, 200_000]),
      );

      const result = await service.getBudgetSuggestion(10, CORRELATION_ID, TENANT_ID);

      expect(metaAdsService.pullCampaigns).toHaveBeenCalledTimes(1);
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.portfolioAvgCplIDR).toBe(150_000);
        expect(result.suggestedBudget).toBe(1_500_000);
        expect(result.targetHotLeads).toBe(10);
      }
    });

    it("ignores null rphLead values when averaging", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client, async () =>
        buildAdAccount([100_000, null, 300_000]),
      );

      const result = await service.getBudgetSuggestion(2, CORRELATION_ID, TENANT_ID);
      expect(result.available).toBe(true);
      if (result.available) {
        expect(result.portfolioAvgCplIDR).toBe(200_000);
      }
    });

    it("honestly reports available: false (never a fabricated default) when there is no computable CPL data", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client, async () => buildAdAccount([null, null]));

      const result = await service.getBudgetSuggestion(10, CORRELATION_ID, TENANT_ID);
      expect(result.available).toBe(false);
      if (!result.available) {
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });

    it("honestly reports available: false when the tenant has no ads at all", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client, async () => buildAdAccount([]));

      const result = await service.getBudgetSuggestion(10, CORRELATION_ID, TENANT_ID);
      expect(result.available).toBe(false);
    });
  });

  describe("updateBusinessContext", () => {
    it("persists all 3 real business-context numbers plus updated_by/updated_at", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client);
      const { service } = buildService(client);

      const result = await service.updateBusinessContext(TENANT_ID, {
        avgDealValue: 50_000_000,
        targetCpl: 25_000,
        breakevenCpl: 30_000,
        updatedBy: "manager@example.com",
      });

      expect(result.avgDealValue).toBe(50_000_000);
      expect(result.targetCpl).toBe(25_000);
      expect(result.breakevenCpl).toBe(30_000);
      expect(result.businessContextUpdatedBy).toBe("manager@example.com");
      expect(result.businessContextUpdatedAt).toBe(FIXED_NOW.toISOString());
    });

    it("throws NotFoundError when the tenant has no current-period objective to attach business context to", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      await expect(service.updateBusinessContext(TENANT_ID, { avgDealValue: 1 })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("updateAutoLoopSettings / getAutoLoopSettingsSafe (AAOS LOOP UPGRADE, Sprint 8a)", () => {
    it("persists a real maxAutoBriefsPerDay/autoApproveCreativeBrief change", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client);
      const { service } = buildService(client);

      const result = await service.updateAutoLoopSettings(TENANT_ID, {
        maxAutoBriefsPerDay: 10,
        autoApproveCreativeBrief: true,
      });

      expect(result.maxAutoBriefsPerDay).toBe(10);
      expect(result.autoApproveCreativeBrief).toBe(true);
    });

    it("throws NotFoundError when the tenant has no current-period objective to attach the setting to", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      await expect(
        service.updateAutoLoopSettings(TENANT_ID, { autoApproveCreativeBrief: true }),
      ).rejects.toThrow(NotFoundError);
    });

    it("SAFETY DEFAULT — getAutoLoopSettingsSafe returns maxAutoBriefsPerDay: 5, autoApproveCreativeBrief: false for a tenant with no current-period objective row (never true)", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      const result = await service.getAutoLoopSettingsSafe(TENANT_ID);

      expect(result).toEqual({ maxAutoBriefsPerDay: 5, autoApproveCreativeBrief: false });
    });

    it("getAutoLoopSettingsSafe returns the real, persisted values when a current-period objective row exists", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { max_auto_briefs_per_day: 3, auto_approve_creative_brief: true });
      const { service } = buildService(client);

      const result = await service.getAutoLoopSettingsSafe(TENANT_ID);

      expect(result).toEqual({ maxAutoBriefsPerDay: 3, autoApproveCreativeBrief: true });
    });
  });

  describe("updateAutoPublishSettings / getAutoPublishSettingsSafe (AAOS LOOP UPGRADE, Sprint 8c)", () => {
    it("persists a real autoPublishCampaign/maxBudgetIncreasePct change", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client);
      const { service } = buildService(client);

      const result = await service.updateAutoPublishSettings(TENANT_ID, {
        autoPublishCampaign: true,
        maxBudgetIncreasePct: 30,
      });

      expect(result.autoPublishCampaign).toBe(true);
      expect(result.maxBudgetIncreasePct).toBe(30);
    });

    it("throws NotFoundError when the tenant has no current-period objective to attach the setting to", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      await expect(
        service.updateAutoPublishSettings(TENANT_ID, { autoPublishCampaign: true }),
      ).rejects.toThrow(NotFoundError);
    });

    it("SAFETY DEFAULT — getAutoPublishSettingsSafe returns autoPublishCampaign: false, maxBudgetIncreasePct: 20 for a tenant with no current-period objective row (never true)", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      const result = await service.getAutoPublishSettingsSafe(TENANT_ID);

      expect(result).toEqual({ autoPublishCampaign: false, maxBudgetIncreasePct: 20 });
    });

    it("getAutoPublishSettingsSafe returns the real, persisted values when a current-period objective row exists", async () => {
      const client = createFakeSupabaseClient();
      seedObjective(client, { auto_publish_campaign: true, max_budget_increase_pct: 15 });
      const { service } = buildService(client);

      const result = await service.getAutoPublishSettingsSafe(TENANT_ID);

      expect(result).toEqual({ autoPublishCampaign: true, maxBudgetIncreasePct: 15 });
    });
  });

  describe("getCurrentSafe", () => {
    it("returns undefined instead of throwing when the tenant has no current-period objective", async () => {
      const client = createFakeSupabaseClient();
      const { service } = buildService(client);

      const result = await service.getCurrentSafe(TENANT_ID);
      expect(result).toBeUndefined();
    });
  });
});
