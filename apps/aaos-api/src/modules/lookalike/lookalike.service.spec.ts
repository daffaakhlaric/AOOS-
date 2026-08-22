import { randomUUID } from "node:crypto";

import "reflect-metadata";

import { BranchId } from "@aos/branch-manager";
import { err, ok } from "@aos/common";
import { LeadBuilder, type Lead, type LeadStore } from "@aos/lead-store";
import { ApiServerError, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";

import type { StoredMetaAudience } from "./domain/meta-audience.js";
import type {
  CreateMetaAudienceInput,
  MetaAudienceRepository,
} from "./infrastructure/meta-audience.repository.js";
import { LookalikeService } from "./lookalike.service.js";

const NOW = new Date("2026-08-21T02:00:00.000Z");

function buildLead(overrides: { phone?: string; synced?: boolean; syncedAt?: Date }): Lead {
  const builder = new LeadBuilder()
    .withBranchId(BranchId.BINTARO)
    .withLeadPhone(overrides.phone ?? "+6281200000001")
    .withStatus("HOT" as never)
    .withTemperature("HOT" as never)
    .withScore(80)
    .withSyncedToMetaAudience(overrides.synced ?? false)
    .withSyncedAt(overrides.syncedAt);
  const result = builder.build();
  if (!result.ok) {
    throw new Error(`buildLead failed: ${result.error.message}`);
  }
  return result.value;
}

function buildFakeAudienceRepository(
  seed: readonly StoredMetaAudience[] = [],
): MetaAudienceRepository {
  const rows = new Map<string, StoredMetaAudience>(seed.map((row) => [row.id, row]));
  return {
    create: vi.fn(async (input: CreateMetaAudienceInput) => {
      const row: StoredMetaAudience = {
        id: input.id,
        tenantId: input.tenantId,
        metaAudienceId: input.metaAudienceId,
        audienceType: input.audienceType,
        name: input.name,
        status: "ACTIVE",
        createdAt: NOW.toISOString(),
        ...(input.originAudienceId !== undefined
          ? { originAudienceId: input.originAudienceId }
          : {}),
        ...(input.percentage !== undefined ? { percentage: input.percentage } : {}),
      };
      rows.set(row.id, row);
      return row;
    }),
    findByTenantAndType: vi.fn(async (tenantId: string, audienceType: string) =>
      [...rows.values()].find(
        (row) => row.tenantId === tenantId && row.audienceType === audienceType,
      ),
    ),
    listByTenant: vi.fn(async (tenantId: string) =>
      [...rows.values()].filter((row) => row.tenantId === tenantId),
    ),
    updateSize: vi.fn(async (id: string, size: number, lastUpdatedAtIso: string) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, size, lastUpdatedAt: lastUpdatedAtIso });
      }
    }),
  } as unknown as MetaAudienceRepository;
}

function buildFakeLeadStore(hotLeadsByBranch: Partial<Record<BranchId, Lead[]>> = {}): LeadStore {
  const marked: string[] = [];
  return {
    getHotLeads: {
      execute: vi.fn(async (branchId: BranchId) => ok(hotLeadsByBranch[branchId] ?? [])),
    },
    markLeadSyncedToMetaAudience: {
      execute: vi.fn(async (input: { leadId: string }) => {
        marked.push(input.leadId);
        return ok({} as unknown as Lead);
      }),
    },
  } as unknown as LeadStore;
}

function buildFakeConnector(
  overrides: Partial<{
    createCustomAudience: MetaAdsConnector["createCustomAudience"];
    addUsersToCustomAudience: MetaAdsConnector["addUsersToCustomAudience"];
    createLookalikeAudience: MetaAdsConnector["createLookalikeAudience"];
  }> = {},
): MetaAdsConnector {
  return {
    createCustomAudience: overrides.createCustomAudience ?? {
      execute: vi.fn(async () => ok({ audienceId: "audience-1" })),
    },
    addUsersToCustomAudience: overrides.addUsersToCustomAudience ?? {
      execute: vi.fn(async () => ok({ numReceived: 1, numInvalidEntries: 0 })),
    },
    createLookalikeAudience: overrides.createLookalikeAudience ?? {
      execute: vi.fn(async () => ok({ audienceId: "lookalike-1" })),
    },
  } as unknown as MetaAdsConnector;
}

function buildService(options: {
  audienceRepository?: MetaAudienceRepository;
  leadStore?: LeadStore;
  connector?: MetaAdsConnector;
}): LookalikeService {
  const config = buildTestConfig();
  return new LookalikeService(
    config,
    options.connector ?? buildFakeConnector(),
    options.leadStore ?? buildFakeLeadStore(),
    options.audienceRepository ?? buildFakeAudienceRepository(),
    () => NOW,
  );
}

describe("LookalikeService (AAOS-ABTESTING-LOOKALIKE Part 2)", () => {
  describe("getStatus", () => {
    it("reports total hot leads, synced count, and progress toward the 100-lead minimum", async () => {
      const leadStore = buildFakeLeadStore({
        [BranchId.BINTARO]: [
          buildLead({ phone: "+6281200000001", synced: true, syncedAt: NOW }),
          buildLead({ phone: "+6281200000002", synced: false }),
        ],
      });
      const service = buildService({ leadStore });
      const status = await service.getStatus();
      expect(status.totalHotLeads).toBe(2);
      expect(status.syncedToMetaAudience).toBe(1);
      expect(status.minRequiredForLookalike).toBe(100);
      expect(status.progressPercentage).toBe(2);
      expect(status.lookalikeEligible).toBe(false);
      expect(status.lastSyncedAt).toBe(NOW.toISOString());
    });

    it("reports lookalikeEligible=true once total hot leads reaches 100", async () => {
      const leads = Array.from({ length: 100 }, (_unused, i) =>
        buildLead({ phone: `+62812000${String(i).padStart(5, "0")}` }),
      );
      const leadStore = buildFakeLeadStore({ [BranchId.BINTARO]: leads });
      const service = buildService({ leadStore });
      const status = await service.getStatus();
      expect(status.totalHotLeads).toBe(100);
      expect(status.progressPercentage).toBe(100);
      expect(status.lookalikeEligible).toBe(true);
    });
  });

  describe("syncHotLeadsToMeta", () => {
    it("returns a zero-summary and makes no connector calls when every hot lead is already synced", async () => {
      const leadStore = buildFakeLeadStore({
        [BranchId.BINTARO]: [buildLead({ synced: true, syncedAt: NOW })],
      });
      const connector = buildFakeConnector();
      const service = buildService({ leadStore, connector });
      const result = await service.syncHotLeadsToMeta();
      expect(result.newlySynced).toBe(0);
      expect(connector.addUsersToCustomAudience.execute).not.toHaveBeenCalled();
    });

    it("creates a new Custom Audience on first sync, uploads unsynced phones, and marks them synced", async () => {
      const leadA = buildLead({ phone: "+6281200000001" });
      const leadB = buildLead({ phone: "+6281200000002" });
      const leadStore = buildFakeLeadStore({ [BranchId.BINTARO]: [leadA, leadB] });
      const audienceRepository = buildFakeAudienceRepository();
      const connector = buildFakeConnector();
      const service = buildService({ leadStore, audienceRepository, connector });

      const result = await service.syncHotLeadsToMeta();

      expect(connector.createCustomAudience.execute).toHaveBeenCalledTimes(1);
      expect(connector.addUsersToCustomAudience.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          customAudienceId: "audience-1",
          phones: ["+6281200000001", "+6281200000002"],
        }),
      );
      expect(leadStore.markLeadSyncedToMetaAudience.execute).toHaveBeenCalledTimes(2);
      expect(result.newlySynced).toBe(2);
      expect(result.totalSynced).toBe(2);
      expect(result.customAudience?.metaAudienceId).toBe("audience-1");
    });

    it("reuses an existing Custom Audience row instead of creating a second one", async () => {
      const existing: StoredMetaAudience = {
        id: randomUUID(),
        tenantId: "dss-motor",
        metaAudienceId: "existing-audience",
        audienceType: "HOT_LEADS",
        name: "AAOS-HotLeads-dss-motor-Aug2026",
        status: "ACTIVE",
        createdAt: NOW.toISOString(),
      };
      const audienceRepository = buildFakeAudienceRepository([existing]);
      const leadStore = buildFakeLeadStore({
        [BranchId.BINTARO]: [buildLead({ phone: "+6281200000003" })],
      });
      const connector = buildFakeConnector();
      const service = buildService({ leadStore, audienceRepository, connector });

      const result = await service.syncHotLeadsToMeta();

      expect(connector.createCustomAudience.execute).not.toHaveBeenCalled();
      expect(connector.addUsersToCustomAudience.execute).toHaveBeenCalledWith(
        expect.objectContaining({ customAudienceId: "existing-audience" }),
      );
      expect(result.customAudience?.metaAudienceId).toBe("existing-audience");
    });

    it("throws when the connector upload fails", async () => {
      const leadStore = buildFakeLeadStore({
        [BranchId.BINTARO]: [buildLead({ phone: "+6281200000004" })],
      });
      const connector = buildFakeConnector({
        addUsersToCustomAudience: {
          execute: vi.fn(async () => err(new ApiServerError("boom"))),
        } as unknown as MetaAdsConnector["addUsersToCustomAudience"],
      });
      const service = buildService({ leadStore, connector });
      await expect(service.syncHotLeadsToMeta()).rejects.toThrow("boom");
    });
  });

  describe("createLookalike", () => {
    it("throws when no HOT_LEADS custom audience exists yet", async () => {
      const service = buildService({});
      await expect(service.createLookalike(1)).rejects.toThrow(/Sync Hot Leads/);
    });

    it("creates a real Lookalike audience seeded from the existing Custom Audience", async () => {
      const origin: StoredMetaAudience = {
        id: randomUUID(),
        tenantId: "dss-motor",
        metaAudienceId: "origin-audience",
        audienceType: "HOT_LEADS",
        name: "AAOS-HotLeads-dss-motor-Aug2026",
        status: "ACTIVE",
        createdAt: NOW.toISOString(),
      };
      const audienceRepository = buildFakeAudienceRepository([origin]);
      const connector = buildFakeConnector();
      const service = buildService({ audienceRepository, connector });

      const created = await service.createLookalike(1);

      expect(connector.createLookalikeAudience.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          originAudienceId: "origin-audience",
          percentage: 1,
          country: "ID",
        }),
      );
      expect(created.metaAudienceId).toBe("lookalike-1");
      expect(created.audienceType).toBe("LOOKALIKE_1PCT");
      expect(created.percentage).toBe(1);
    });

    it("is idempotent — returns the existing row instead of creating a second Lookalike of the same percentage", async () => {
      const origin: StoredMetaAudience = {
        id: randomUUID(),
        tenantId: "dss-motor",
        metaAudienceId: "origin-audience",
        audienceType: "HOT_LEADS",
        name: "AAOS-HotLeads-dss-motor-Aug2026",
        status: "ACTIVE",
        createdAt: NOW.toISOString(),
      };
      const existingLookalike: StoredMetaAudience = {
        id: randomUUID(),
        tenantId: "dss-motor",
        metaAudienceId: "existing-lookalike",
        audienceType: "LOOKALIKE_1PCT",
        name: "AAOS-Lookalike-1pct-dss-motor",
        status: "ACTIVE",
        percentage: 1,
        originAudienceId: "origin-audience",
        createdAt: NOW.toISOString(),
      };
      const audienceRepository = buildFakeAudienceRepository([origin, existingLookalike]);
      const connector = buildFakeConnector();
      const service = buildService({ audienceRepository, connector });

      const result = await service.createLookalike(1);

      expect(connector.createLookalikeAudience.execute).not.toHaveBeenCalled();
      expect(result.metaAudienceId).toBe("existing-lookalike");
    });
  });

  describe("runLookalikeSync", () => {
    it("returns a CalendarEventResult with a real summary", async () => {
      const leadStore = buildFakeLeadStore({
        [BranchId.BINTARO]: [buildLead({ synced: true, syncedAt: NOW })],
      });
      const service = buildService({ leadStore });
      const result = await service.runLookalikeSync();
      expect(result.summary).toBe("0 hot leads baru untuk disync");
    });
  });
});
