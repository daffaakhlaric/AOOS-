import { ok, err } from "@aos/common";
import { ConflictError, ValidationError } from "@aos/errors";
import { ApiServerError, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  WabaConfigRepository,
  WabaConfigRow,
} from "../settings/infrastructure/waba-config.repository.js";
import type {
  GoLiveRollbackData,
  StoredSimulation,
} from "../simulation/domain/simulation-record.js";
import type { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { GO_LIVE_CONFIRMATION_TEXT, type GoLiveBodyDto } from "./dto/go-live-body.dto.js";
import { GoLiveService } from "./go-live.service.js";

const NOW = new Date("2026-08-13T12:00:00.000Z");

function buildSimulation(overrides: Partial<StoredSimulation> = {}): StoredSimulation {
  return {
    id: "sim-1",
    tenantId: "dss-motor",
    objectiveSnapshot: { budget: 3_000_000 },
    campaignDataSource: "cache",
    personaIds: ["ready_buyer"],
    branch: "CINERE",
    status: "DONE",
    currentStep: "DONE",
    decision: "APPROVED",
    result: {
      samantha: { available: true, elapsedMs: 1, coverageScore: 80 },
      kai: { available: true, elapsedMs: 1, videoGenerated: false, note: "n" },
      clara: { available: true, runs: [], elapsedMs: 1 },
      scoring: {
        samanthaCoverageScore: 80,
        kaiScore: 80,
        claraScore: 80,
        overallScore: 80,
        grade: "B",
        verdict: "GO",
      },
    },
    createdAt: "2026-08-13T08:00:00.000Z",
    updatedAt: "2026-08-13T08:00:00.000Z",
    ...overrides,
  };
}

function buildFakeRepository(
  simulation: StoredSimulation,
  overrides: Partial<SimulationRepository> = {},
): SimulationRepository {
  return {
    findById: vi.fn(async () => simulation),
    hasLiveSince: vi.fn(async () => false),
    markLive: vi.fn(async () => undefined),
    markRolledBack: vi.fn(async () => undefined),
    appendLog: vi.fn(async () => undefined),
    listLogs: vi.fn(async () => []),
    listLive: vi.fn(async () => []),
    ...overrides,
  } as unknown as SimulationRepository;
}

function buildFakeWabaRepository(rows: readonly WabaConfigRow[] = []): WabaConfigRepository {
  return {
    listByTenant: vi.fn(async () => rows),
  } as unknown as WabaConfigRepository;
}

const wabaRow: WabaConfigRow = {
  id: "waba-1",
  tenant_id: "dss-motor",
  branch_id: "CINERE",
  phone_number: "+628110000002",
  waba_id: "waba-cinere-1",
  phone_number_id: "100000000000002",
  access_token: "waba-token",
  status: "ACTIVE",
  last_tested_at: null,
  last_test_result: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function buildFakeConnector(overrides: Record<string, unknown> = {}): MetaAdsConnector {
  return {
    client: {
      createCampaign: vi.fn().mockResolvedValue(ok({ id: "campaign-1" })),
      createAdSet: vi.fn().mockResolvedValue(ok({ id: "adset-1" })),
    },
    uploadCreativeAsset: {
      execute: vi.fn().mockResolvedValue(ok({ assetType: "IMAGE", assetId: "hash-1" })),
    },
    createAd: { execute: vi.fn().mockResolvedValue(ok({ adId: "ad-1" })) },
    pauseCampaign: {
      execute: vi.fn().mockResolvedValue(ok({ campaignId: "campaign-1", status: "PAUSED" })),
    },
    activateAd: { execute: vi.fn().mockResolvedValue(ok({ adId: "ad-1", status: "ACTIVE" })) },
    ...overrides,
  } as unknown as MetaAdsConnector;
}

const goLiveBody: GoLiveBodyDto = {
  confirmation: GO_LIVE_CONFIRMATION_TEXT,
  dailyBudgetIDR: 50_000,
  creative: {
    assetType: "IMAGE",
    hostedUrl: "https://storage.googleapis.com/aaos/creative.jpg",
    primaryText: "Promo!",
  },
};

function makeService(
  simulation: StoredSimulation,
  connectorOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {},
  repoOverrides: Partial<SimulationRepository> = {},
) {
  const repository = buildFakeRepository(simulation, repoOverrides);
  const wabaRepository = buildFakeWabaRepository([wabaRow]);
  const connector = buildFakeConnector(connectorOverrides);
  const config = buildTestConfig({ GO_LIVE_DRY_RUN: false, ...configOverrides });
  const connectorRegistry = {
    resolve: vi.fn(async () =>
      ok({
        ...connector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      }),
    ),
  };
  const service = new GoLiveService(
    config,
    connectorRegistry as never,
    repository,
    wabaRepository,
    () => NOW,
  );
  return { service, repository, connector, connectorRegistry };
}

describe("GoLiveService.execute — guards (fail closed, before any external call)", () => {
  it("rejects a wrong confirmation string without calling any connector method", async () => {
    const simulation = buildSimulation();
    const { service, connector } = makeService(simulation);
    await expect(
      service.execute("sim-1", { ...goLiveBody, confirmation: "go live" }, "corr-1"),
    ).rejects.toThrow(ValidationError);
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
  });

  it("rejects when the simulation status is not DONE", async () => {
    const simulation = buildSimulation({ status: "RUNNING" });
    const { service } = makeService(simulation);
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ConflictError);
  });

  it("rejects when decision is not APPROVED", async () => {
    const simulation = buildSimulation({ decision: "REJECTED" });
    const { service } = makeService(simulation);
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ValidationError);
  });

  it("rejects when overallScore is below GO_LIVE_MIN_SCORE", async () => {
    const simulation = buildSimulation({
      result: {
        ...buildSimulation().result!,
        scoring: { ...buildSimulation().result!.scoring, overallScore: 40 },
      },
    });
    const { service } = makeService(simulation, {}, { GO_LIVE_MIN_SCORE: 60 });
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ValidationError);
  });

  it("rejects when another simulation already went live today", async () => {
    const simulation = buildSimulation();
    const { service } = makeService(simulation, {}, {}, { hasLiveSince: vi.fn(async () => true) });
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ConflictError);
  });

  it("rejects when dailyBudgetIDR exceeds objective.budget / 30", async () => {
    const simulation = buildSimulation({ objectiveSnapshot: { budget: 300_000 } }); // cap = 10,000
    const { service } = makeService(simulation);
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ValidationError);
  });

  it("rejects when objective.budget is missing/non-numeric", async () => {
    const simulation = buildSimulation({ objectiveSnapshot: {} });
    const { service } = makeService(simulation);
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ValidationError);
  });

  it("rejects a real (non-dry-run) request when META_PAGE_ID is unset", async () => {
    const simulation = buildSimulation();
    const { service } = makeService(simulation, {}, { META_PAGE_ID: "" });
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toThrow(ValidationError);
  });
});

describe("GoLiveService.execute — dry run", () => {
  it("logs [DRY RUN] steps and never calls a connector method or markLive", async () => {
    const simulation = buildSimulation();
    const { service, repository, connector } = makeService(
      simulation,
      {},
      { GO_LIVE_DRY_RUN: true },
    );
    await service.execute("sim-1", goLiveBody, "corr-1");
    expect(connector.client.createCampaign).not.toHaveBeenCalled();
    expect(connector.createAd.execute).not.toHaveBeenCalled();
    expect(repository.markLive).not.toHaveBeenCalled();
    const logCalls = (repository.appendLog as ReturnType<typeof vi.fn>).mock.calls;
    expect(logCalls.some(([, entry]) => String(entry.message).includes("[DRY RUN]"))).toBe(true);
  });
});

describe("GoLiveService.execute — real run", () => {
  it("creates campaign+adset (ACTIVE), uploads the creative, creates the ad, and marks LIVE", async () => {
    const simulation = buildSimulation();
    const { service, repository, connector } = makeService(simulation);
    const result = await service.execute("sim-1", goLiveBody, "corr-1");

    expect(connector.client.createCampaign).toHaveBeenCalledWith(
      "act_752604553578354",
      expect.objectContaining({ status: "ACTIVE" }),
      "test-access-token",
    );
    expect(connector.client.createAdSet).toHaveBeenCalledWith(
      "act_752604553578354",
      expect.objectContaining({
        campaignId: "campaign-1",
        status: "ACTIVE",
        dailyBudgetCents: 5_000_000,
      }),
      "test-access-token",
    );
    expect(connector.uploadCreativeAsset.execute).toHaveBeenCalled();
    expect(connector.createAd.execute).toHaveBeenCalledWith(
      expect.objectContaining({ adSetId: "adset-1", status: "ACTIVE" }),
    );
    expect(repository.markLive).toHaveBeenCalledWith(
      "sim-1",
      "campaign-1",
      "ad-1",
      NOW.toISOString(),
      expect.objectContaining({
        newCampaignId: "campaign-1",
        newAdSetId: "adset-1",
        newAdId: "ad-1",
      }),
    );
    expect(result).toBeDefined();
  });

  it("stops and does NOT mark LIVE when campaign creation fails", async () => {
    const simulation = buildSimulation();
    const { service, repository } = makeService(simulation, {
      client: {
        createCampaign: vi
          .fn()
          .mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
        createAdSet: vi.fn(),
      },
    });
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toBeInstanceOf(
      ApiServerError,
    );
    expect(repository.markLive).not.toHaveBeenCalled();
  });

  it("stops and does NOT mark LIVE when ad creation fails after campaign+adset succeeded", async () => {
    const simulation = buildSimulation();
    const { service, repository, connector } = makeService(simulation, {
      createAd: {
        execute: vi.fn().mockResolvedValue(err(new ApiServerError("boom", { httpStatus: 500 }))),
      },
    });
    await expect(service.execute("sim-1", goLiveBody, "corr-1")).rejects.toBeInstanceOf(
      ApiServerError,
    );
    expect(connector.client.createCampaign).toHaveBeenCalled();
    expect(repository.markLive).not.toHaveBeenCalled();
  });
});

describe("GoLiveService.pauseLive", () => {
  it("rejects when the simulation has no live campaign", async () => {
    const simulation = buildSimulation({ status: "DONE" });
    const { service } = makeService(simulation);
    await expect(service.pauseLive("sim-1", "corr-1")).rejects.toThrow(ConflictError);
  });

  it("pauses the live campaign and keeps status LIVE", async () => {
    const simulation = buildSimulation({
      status: "LIVE",
      liveCampaignId: "campaign-1",
      liveAdId: "ad-1",
      liveAt: "2026-08-13T11:30:00.000Z",
    });
    const { service, connector } = makeService(simulation);
    await service.pauseLive("sim-1", "corr-1");
    expect(connector.pauseCampaign.execute).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      accessToken: "test-access-token",
    });
  });
});

describe("GoLiveService.rollback", () => {
  const rollbackData: GoLiveRollbackData = {
    newCampaignId: "campaign-1",
    newAdSetId: "adset-1",
    newAdId: "ad-1",
    mutatedEntities: [{ targetType: "ad", targetId: "ad-99", action: "PAUSED", reversible: true }],
  };

  it("rejects when the simulation is not LIVE", async () => {
    const simulation = buildSimulation({ status: "DONE" });
    const { service } = makeService(simulation);
    await expect(service.rollback("sim-1", {}, "corr-1")).rejects.toThrow(ConflictError);
  });

  it("rejects once the rollback window has expired", async () => {
    const simulation = buildSimulation({
      status: "LIVE",
      liveAt: "2026-08-13T00:00:00.000Z", // 12h before NOW; window is 1h
      rollbackData,
    });
    const { service } = makeService(simulation, {}, { ROLLBACK_WINDOW_HOURS: 1 });
    await expect(service.rollback("sim-1", {}, "corr-1")).rejects.toThrow(ConflictError);
  });

  it("pauses the campaign, reactivates reversible ads, logs ROLLBACK_COMPLETE, and marks ROLLED_BACK", async () => {
    const simulation = buildSimulation({
      status: "LIVE",
      liveAt: "2026-08-13T11:30:00.000Z", // 30min before NOW; window is 1h
      rollbackData,
    });
    const { service, repository, connector } = makeService(
      simulation,
      {},
      { ROLLBACK_WINDOW_HOURS: 1 },
    );
    const result = await service.rollback("sim-1", {}, "corr-1");
    expect(connector.pauseCampaign.execute).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      accessToken: "test-access-token",
    });
    expect(connector.activateAd.execute).toHaveBeenCalledWith({
      adId: "ad-99",
      accessToken: "test-access-token",
    });
    expect(repository.markRolledBack).toHaveBeenCalledWith("sim-1", NOW.toISOString());
    const logCalls = (repository.appendLog as ReturnType<typeof vi.fn>).mock.calls;
    expect(logCalls.some(([, entry]) => entry.message === "ROLLBACK_COMPLETE")).toBe(true);
    expect(result).toBeDefined();
  });
});
