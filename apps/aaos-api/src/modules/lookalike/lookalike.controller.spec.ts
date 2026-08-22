import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import type { StoredMetaAudience } from "./domain/meta-audience.js";
import { LookalikeController } from "./lookalike.controller.js";
import type { LookalikeService } from "./lookalike.service.js";

function buildFakeAudience(overrides: Partial<StoredMetaAudience> = {}): StoredMetaAudience {
  return {
    id: "audience-row-1",
    tenantId: "dss-motor",
    metaAudienceId: "audience-1",
    audienceType: "HOT_LEADS",
    name: "AAOS-HotLeads-dss-motor-Aug2026",
    status: "ACTIVE",
    createdAt: "2026-08-21T02:00:00.000Z",
    ...overrides,
  };
}

function buildFakeService(overrides: Partial<LookalikeService> = {}): LookalikeService {
  const audience = buildFakeAudience();
  return {
    getStatus: vi.fn(async () => ({
      totalHotLeads: 47,
      syncedToMetaAudience: 38,
      minRequiredForLookalike: 100,
      progressPercentage: 47,
      lookalikeEligible: false,
      lastSyncedAt: "2026-08-21T02:00:00.000Z",
      customAudience: audience,
    })),
    listAudiences: vi.fn(async () => [audience]),
    syncHotLeadsToMeta: vi.fn(async () => ({
      summary: "5 hot leads baru disync ke Meta Custom Audience",
      newlySynced: 5,
      totalSynced: 43,
      customAudience: audience,
    })),
    createLookalike: vi.fn(async () => buildFakeAudience({ audienceType: "LOOKALIKE_1PCT" })),
    ...overrides,
  } as unknown as LookalikeService;
}

describe("LookalikeController", () => {
  it("GET /status returns the status card fields", async () => {
    const service = buildFakeService();
    const controller = new LookalikeController(service);
    const result = await controller.status();
    expect(result.totalHotLeads).toBe(47);
    expect(result.syncedToMetaAudience).toBe(38);
    expect(result.customAudience?.metaAudienceId).toBe("audience-1");
  });

  it("GET /audiences lists every audience", async () => {
    const service = buildFakeService();
    const controller = new LookalikeController(service);
    const result = await controller.audiences();
    expect(result).toHaveLength(1);
    expect(result[0]?.audienceType).toBe("HOT_LEADS");
  });

  it("POST /sync triggers a sync and returns the result", async () => {
    const service = buildFakeService();
    const controller = new LookalikeController(service);
    const result = await controller.sync();
    expect(service.syncHotLeadsToMeta).toHaveBeenCalled();
    expect(result.newlySynced).toBe(5);
  });

  it("POST /audiences/lookalike creates a Lookalike audience", async () => {
    const service = buildFakeService();
    const controller = new LookalikeController(service);
    const result = await controller.createLookalike({ percentage: 1 });
    expect(service.createLookalike).toHaveBeenCalledWith(1);
    expect(result.audienceType).toBe("LOOKALIKE_1PCT");
  });
});
