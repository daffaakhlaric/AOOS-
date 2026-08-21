import { randomUUID } from "node:crypto";

import "reflect-metadata";

import { AdAngle } from "@aos/meta-ads-agent";
import {
  AdBuilder,
  AdMetrics,
  AdSetBuilder,
  Budget,
  CampaignBuilder,
  Spend,
  type AdAccount,
  type MetaAdsConnector,
} from "@aos/meta-ads-connector";
import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import type {
  CreativePackageDetailResponseDto,
  CreativePackageResponseDto,
} from "../creative-packages/dto/creative-package-response.dto.js";

import { AbTestingService } from "./abtesting.service.js";
import type { StoredAbTest, StoredAbTestVariant } from "./domain/ab-test.js";
import type { CreateAbTestBodyDto } from "./dto/create-ab-test.dto.js";
import type {
  AbTestVariantRepository,
  CreateAbTestVariantInput,
} from "./infrastructure/ab-test-variant.repository.js";
import type { AbTestRepository, CreateAbTestInput } from "./infrastructure/ab-test.repository.js";

function unwrap<T>(result: { ok: boolean; value?: T; error?: unknown }): T {
  if (!result.ok) {
    throw new Error(`unwrap failed: ${JSON.stringify(result.error)}`);
  }
  return result.value as T;
}

// ---------------------------------------------------------------------------------------------
// In-memory fakes — the service re-reads its own writes within a single call (e.g. re-listing a
// test's variants after marking one READY), so a stateless `vi.fn()` stub cannot exercise the
// real control flow. These mirror the real repositories' public surface exactly.
// ---------------------------------------------------------------------------------------------

function buildFakeTestRepository(seed: readonly StoredAbTest[] = []): AbTestRepository {
  const rows = new Map<string, StoredAbTest>(seed.map((row) => [row.id, row]));
  return {
    create: vi.fn(async (input: CreateAbTestInput) => {
      const row: StoredAbTest = {
        id: input.id,
        tenantId: input.tenantId,
        name: input.name,
        campaignId: input.campaignId,
        adSetId: input.adSetId,
        pageId: input.pageId,
        waLink: input.waLink,
        mode: input.mode,
        status: "DRAFT",
        thresholdSpend: input.thresholdSpend,
        thresholdDays: input.thresholdDays,
        minMarginPct: input.minMarginPct,
        autoPauseLoser: input.autoPauseLoser,
        autoScaleWinner: input.autoScaleWinner,
        createdAt: new Date().toISOString(),
      };
      rows.set(row.id, row);
      return row;
    }),
    findById: vi.fn(async (_tenantId: string, id: string) => rows.get(id)),
    listByTenant: vi.fn(async (_tenantId: string, status?: string) =>
      [...rows.values()].filter((row) => status === undefined || row.status === status),
    ),
    listByStatus: vi.fn(async (_tenantId: string, status: string) =>
      [...rows.values()].filter((row) => row.status === status),
    ),
    listByCampaign: vi.fn(async (_tenantId: string, campaignId: string) =>
      [...rows.values()].filter((row) => row.campaignId === campaignId),
    ),
    markStatus: vi.fn(async (id: string, status: never) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, status });
      }
    }),
    markRunning: vi.fn(async (id: string, startedAtIso: string) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, status: "RUNNING", startedAt: startedAtIso });
      }
    }),
    markFailed: vi.fn(async (id: string, reason: string) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, status: "FAILED", failedReason: reason });
      }
    }),
    markComplete: vi.fn(
      async (
        id: string,
        winnerVariantId: string,
        winnerRphLead: number,
        improvementPct: number,
        completedAtIso: string,
      ) => {
        const row = rows.get(id);
        if (row !== undefined) {
          rows.set(id, {
            ...row,
            status: "COMPLETE",
            winnerVariantId,
            winnerRphLead,
            improvementPct,
            completedAt: completedAtIso,
          });
        }
      },
    ),
  } as unknown as AbTestRepository;
}

function buildFakeVariantRepository(
  seed: readonly StoredAbTestVariant[] = [],
): AbTestVariantRepository {
  const rows = new Map<string, StoredAbTestVariant>(seed.map((row) => [row.id, row]));
  return {
    create: vi.fn(async (input: CreateAbTestVariantInput) => {
      const row: StoredAbTestVariant = {
        id: input.id,
        abTestId: input.abTestId,
        tenantId: input.tenantId,
        variantLabel: input.variantLabel,
        angle: input.angle,
        creativePackageId: input.creativePackageId,
        status: "PENDING_CREATIVE",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      };
      rows.set(row.id, row);
      return row;
    }),
    listByAbTest: vi.fn(async (abTestId: string) =>
      [...rows.values()]
        .filter((row) => row.abTestId === abTestId)
        .sort((a, b) => a.variantLabel.localeCompare(b.variantLabel)),
    ),
    markStatus: vi.fn(async (id: string, status: never) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, status });
      }
    }),
    markLaunched: vi.fn(async (id: string, metaAdId: string) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, { ...row, metaAdId, status: "RUNNING" });
      }
    }),
    updateInsights: vi.fn(
      async (
        id: string,
        input: {
          spend: number;
          impressions: number;
          clicks: number;
          conversations: number;
          leads: number;
          rphLead: number | null;
          ctr: number | null;
          lastSyncedAtIso: string;
        },
      ) => {
        const row = rows.get(id);
        if (row !== undefined) {
          rows.set(id, {
            ...row,
            spend: input.spend,
            impressions: input.impressions,
            clicks: input.clicks,
            conversations: input.conversations,
            leads: input.leads,
            ...(input.rphLead !== null ? { rphLead: input.rphLead } : {}),
            ...(input.ctr !== null ? { ctr: input.ctr } : {}),
            lastSyncedAt: input.lastSyncedAtIso,
          });
        }
      },
    ),
  } as unknown as AbTestVariantRepository;
}

function buildFakeCreativePackages(
  overrides: Record<string, Partial<CreativePackageDetailResponseDto["package"]>> = {},
): CreativePackagesService {
  let counter = 0;
  return {
    create: vi.fn(async (): Promise<CreativePackageResponseDto> => {
      counter += 1;
      return {
        id: `pkg-${String(counter)}`,
        status: "DRAFT",
      } as unknown as CreativePackageResponseDto;
    }),
    byId: vi.fn(async (id: string): Promise<CreativePackageDetailResponseDto> => {
      const found = overrides[id];
      return {
        package: {
          id,
          status: "PENDING",
          videoUrl: "https://cdn.example.com/video.mp4",
          imageUrls: ["https://cdn.example.com/thumb.jpg"],
          copyVariants: [{ id: "cv-1", variantLabel: "A", primaryText: "Yuk DP ringan!" }],
          ...found,
        },
        logs: [],
      } as unknown as CreativePackageDetailResponseDto;
    }),
  } as unknown as CreativePackagesService;
}

function buildFakeConnector(
  overrides: Partial<{
    pullCampaignData: MetaAdsConnector["pullCampaignData"];
    uploadCreativeAsset: MetaAdsConnector["uploadCreativeAsset"];
    createAd: MetaAdsConnector["createAd"];
    verdictService: MetaAdsConnector["verdictService"];
  }> = {},
): MetaAdsConnector {
  return {
    pullCampaignData: overrides.pullCampaignData ?? {
      execute: vi.fn(async () => ({ ok: false, error: new Error("not configured") })),
    },
    uploadCreativeAsset:
      overrides.uploadCreativeAsset ??
      ({
        execute: vi.fn(async () => ({
          ok: true,
          value: { assetType: "VIDEO", assetId: "asset-1" },
        })),
      } as never),
    createAd:
      overrides.createAd ??
      ({ execute: vi.fn(async () => ({ ok: true, value: { adId: "ad-generic" } })) } as never),
    verdictService:
      overrides.verdictService ??
      ({
        execute: vi.fn(async () => ({
          ok: true,
          value: { action: "NO_ACTION", targetId: "x", targetType: "ad" },
        })),
      } as never),
    client: {},
  } as unknown as MetaAdsConnector;
}

function buildService(options: {
  testRepository?: AbTestRepository;
  variantRepository?: AbTestVariantRepository;
  creativePackages?: CreativePackagesService;
  connector?: MetaAdsConnector;
  now?: () => Date;
}): AbTestingService {
  const config = buildTestConfig();
  return new AbTestingService(
    config,
    options.connector ?? buildFakeConnector(),
    options.creativePackages ?? buildFakeCreativePackages(),
    options.testRepository ?? buildFakeTestRepository(),
    options.variantRepository ?? buildFakeVariantRepository(),
    options.now ?? (() => new Date("2026-08-19T06:00:00.000Z")),
  );
}

const CREATE_BODY: CreateAbTestBodyDto = {
  name: "Xpander Cinere — DP vs Stok",
  campaignId: "camp-1",
  adSetId: "adset-1",
  pageId: "page-1",
  waLink: "https://wa.me/6281234567890",
  mode: "AUTO",
  variantCount: 2,
  unit: "xpander-cinere",
  branch: "CINERE" as never,
  targetPersona: "PRIMARY_FAMILY" as never,
  primaryMessage: "DP ringan mulai 20 juta",
  format: "VIDEO_AND_IMAGES",
  urgency: "MEDIUM",
  thresholdSpend: 100_000,
  thresholdDays: 3,
  minMarginPct: 20,
  autoPauseLoser: true,
  autoScaleWinner: true,
};

describe("AbTestingService.createTest", () => {
  it("picks the first unused angle pair and creates one creative package + variant per angle", async () => {
    const creativePackages = buildFakeCreativePackages();
    const testRepository = buildFakeTestRepository();
    const variantRepository = buildFakeVariantRepository();
    const service = buildService({ creativePackages, testRepository, variantRepository });

    const test = await service.createTest(CREATE_BODY);

    expect(test.status).toBe("DRAFT");
    expect(creativePackages.create).toHaveBeenCalledTimes(2);
    expect(creativePackages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        angle: AdAngle.DP_RINGAN,
        title: expect.stringContaining("Variant A"),
      }),
    );
    expect(creativePackages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        angle: AdAngle.GUDANGNYA,
        title: expect.stringContaining("Variant B"),
      }),
    );

    const variants = await variantRepository.listByAbTest(test.id);
    expect(variants).toHaveLength(2);
    expect(variants.every((v) => v.status === "PENDING_CREATIVE")).toBe(true);
  });

  it("skips an angle pair already used by a prior test on the same campaign", async () => {
    const priorTestId = randomUUID();
    const testRepository = buildFakeTestRepository([
      {
        id: priorTestId,
        tenantId: "dss-motor",
        name: "Prior test",
        campaignId: "camp-1",
        adSetId: "adset-1",
        pageId: "page-1",
        waLink: "https://wa.me/1",
        mode: "AUTO",
        status: "COMPLETE",
        thresholdSpend: 100_000,
        thresholdDays: 3,
        minMarginPct: 20,
        autoPauseLoser: true,
        autoScaleWinner: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    const variantRepository = buildFakeVariantRepository([
      {
        id: "v-1",
        abTestId: priorTestId,
        tenantId: "dss-motor",
        variantLabel: "A",
        angle: AdAngle.DP_RINGAN,
        creativePackageId: "pkg-old-a",
        status: "WINNER",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "v-2",
        abTestId: priorTestId,
        tenantId: "dss-motor",
        variantLabel: "B",
        angle: AdAngle.GUDANGNYA,
        creativePackageId: "pkg-old-b",
        status: "PAUSED_LOSER",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    const creativePackages = buildFakeCreativePackages();
    const service = buildService({ testRepository, variantRepository, creativePackages });

    await service.createTest(CREATE_BODY);

    expect(creativePackages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        angle: AdAngle.DP_RINGAN,
        title: expect.stringContaining("Variant A"),
      }),
    );
    expect(creativePackages.create).toHaveBeenCalledWith(
      expect.objectContaining({ angle: AdAngle.TESTIMONIAL }),
    );
  });
});

describe("AbTestingService.runAbTestCheck — launching a DRAFT test", () => {
  function draftTestWithVariants(): {
    testRepository: AbTestRepository;
    variantRepository: AbTestVariantRepository;
    testId: string;
  } {
    const testId = randomUUID();
    const testRepository = buildFakeTestRepository([
      {
        id: testId,
        tenantId: "dss-motor",
        name: "ABT-Test",
        campaignId: "camp-1",
        adSetId: "adset-1",
        pageId: "page-1",
        waLink: "https://wa.me/6281234567890",
        mode: "AUTO",
        status: "DRAFT",
        thresholdSpend: 100_000,
        thresholdDays: 3,
        minMarginPct: 20,
        autoPauseLoser: true,
        autoScaleWinner: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    const variantRepository = buildFakeVariantRepository([
      {
        id: "var-a",
        abTestId: testId,
        tenantId: "dss-motor",
        variantLabel: "A",
        angle: AdAngle.DP_RINGAN,
        creativePackageId: "pkg-a",
        status: "PENDING_CREATIVE",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "var-b",
        abTestId: testId,
        tenantId: "dss-motor",
        variantLabel: "B",
        angle: AdAngle.GUDANGNYA,
        creativePackageId: "pkg-b",
        status: "PENDING_CREATIVE",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    return { testRepository, variantRepository, testId };
  }

  it("launches a test once every variant's creative package is generated (PENDING), creating one real Meta ad per variant", async () => {
    const { testRepository, variantRepository, testId } = draftTestWithVariants();
    const createAd = { execute: vi.fn(async () => ({ ok: true, value: { adId: "ad-launched" } })) };
    const uploadCreativeAsset = {
      execute: vi.fn(async () => ({ ok: true, value: { assetType: "VIDEO", assetId: "asset-1" } })),
    };
    const connector = buildFakeConnector({
      createAd: createAd as never,
      uploadCreativeAsset: uploadCreativeAsset as never,
    });
    const creativePackages = buildFakeCreativePackages();
    const service = buildService({
      testRepository,
      variantRepository,
      connector,
      creativePackages,
    });

    const result = await service.runAbTestCheck();

    expect(result.launched).toBe(1);
    expect(createAd.execute).toHaveBeenCalledTimes(2);
    const variants = await variantRepository.listByAbTest(testId);
    expect(variants.every((v) => v.status === "RUNNING")).toBe(true);
    expect(variants.every((v) => v.metaAdId === "ad-launched")).toBe(true);
    const test = await testRepository.findById("dss-motor", testId);
    expect(test?.status).toBe("RUNNING");
  });

  it("marks the test FAILED when a variant's creative generation failed", async () => {
    const { testRepository, variantRepository, testId } = draftTestWithVariants();
    const creativePackages = buildFakeCreativePackages({ "pkg-a": { status: "FAILED" } });
    const service = buildService({ testRepository, variantRepository, creativePackages });

    await service.runAbTestCheck();

    const test = await testRepository.findById("dss-motor", testId);
    expect(test?.status).toBe("FAILED");
  });

  it("does not launch a test while any variant is still GENERATING", async () => {
    const { testRepository, variantRepository, testId } = draftTestWithVariants();
    const creativePackages = buildFakeCreativePackages({ "pkg-a": { status: "GENERATING" } });
    const service = buildService({ testRepository, variantRepository, creativePackages });

    const result = await service.runAbTestCheck();

    expect(result.launched).toBe(0);
    const test = await testRepository.findById("dss-motor", testId);
    expect(test?.status).toBe("DRAFT");
  });
});

describe("AbTestingService.runAbTestCheck — monitoring a RUNNING test", () => {
  function buildAdAccountWithTwoAds(): AdAccount {
    const metricsA = unwrap(
      AdMetrics.create({
        spend: unwrap(Spend.create(52_000)),
        impressions: 12_400,
        reach: 10_000,
        clicks: 260,
        conversations: 8,
        d2: 0,
        d3: 6,
        d5: 0,
        leadForm: 0,
      }),
    );
    const metricsB = unwrap(
      AdMetrics.create({
        spend: unwrap(Spend.create(48_000)),
        impressions: 11_200,
        reach: 9_000,
        clicks: 200,
        conversations: 6,
        d2: 0,
        d3: 4,
        d5: 0,
        leadForm: 0,
      }),
    );
    const adA = unwrap(new AdBuilder().withMetaId("ad-a").withMetrics(metricsA).build());
    const adB = unwrap(new AdBuilder().withMetaId("ad-b").withMetrics(metricsB).build());
    const adSet = unwrap(
      new AdSetBuilder()
        .withMetaId("adset-1")
        .withDailyBudget(unwrap(Budget.create(100_000)))
        .withAds([adA, adB])
        .build(),
    );
    const campaign = unwrap(new CampaignBuilder().withAdSets([adSet]).build());
    return {
      id: campaign.adSets[0]?.adAccountId,
      name: "Test Ad Account",
      businessManagerId: "bm_1",
      currency: "IDR",
      timezone: "Asia/Jakarta",
      campaigns: [campaign],
      syncedAt: new Date("2026-08-19T00:00:00.000Z"),
    } as unknown as AdAccount;
  }

  function runningTestWithVariants(overrides: Partial<StoredAbTest> = {}): {
    testRepository: AbTestRepository;
    variantRepository: AbTestVariantRepository;
    testId: string;
  } {
    const testId = randomUUID();
    const testRepository = buildFakeTestRepository([
      {
        id: testId,
        tenantId: "dss-motor",
        name: "ABT-Running",
        campaignId: "camp-1",
        adSetId: "adset-1",
        pageId: "page-1",
        waLink: "https://wa.me/6281234567890",
        mode: "AUTO",
        status: "RUNNING",
        thresholdSpend: 100_000,
        thresholdDays: 3,
        minMarginPct: 20,
        autoPauseLoser: true,
        autoScaleWinner: true,
        startedAt: "2026-08-15T06:00:00.000Z",
        createdAt: new Date().toISOString(),
        ...overrides,
      },
    ]);
    const variantRepository = buildFakeVariantRepository([
      {
        id: "var-a",
        abTestId: testId,
        tenantId: "dss-motor",
        variantLabel: "A",
        angle: AdAngle.DP_RINGAN,
        creativePackageId: "pkg-a",
        metaAdId: "ad-a",
        status: "RUNNING",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: "var-b",
        abTestId: testId,
        tenantId: "dss-motor",
        variantLabel: "B",
        angle: AdAngle.GUDANGNYA,
        creativePackageId: "pkg-b",
        metaAdId: "ad-b",
        status: "RUNNING",
        spend: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
        leads: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
    return { testRepository, variantRepository, testId };
  }

  it("declares a winner, pauses the loser, and scales the winner's ad set once threshold + margin are met", async () => {
    const { testRepository, variantRepository, testId } = runningTestWithVariants();
    const pullCampaignData = {
      execute: vi.fn(async () => ({ ok: true, value: buildAdAccountWithTwoAds() })),
    };
    const verdictService = {
      execute: vi.fn(async () => ({
        ok: true,
        value: { action: "NO_ACTION", targetId: "x", targetType: "ad" },
      })),
    };
    const connector = buildFakeConnector({
      pullCampaignData: pullCampaignData as never,
      verdictService: verdictService as never,
    });
    const service = buildService({
      testRepository,
      variantRepository,
      connector,
      now: () => new Date("2026-08-19T06:00:00.000Z"),
    });

    const result = await service.runAbTestCheck();

    expect(result.winnersDeclared).toBe(1);
    const test = await testRepository.findById("dss-motor", testId);
    expect(test?.status).toBe("COMPLETE");
    expect(test?.winnerVariantId).toBe("var-a");

    const variants = await variantRepository.listByAbTest(testId);
    const winner = variants.find((v) => v.id === "var-a");
    const loser = variants.find((v) => v.id === "var-b");
    expect(winner?.status).toBe("WINNER");
    expect(loser?.status).toBe("PAUSED_LOSER");

    expect(verdictService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: "PAUSE", targetId: "ad-b", targetType: "ad" }),
    );
    expect(verdictService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        verdict: "SCALE",
        targetId: "adset-1",
        targetType: "adset",
        currentDailyBudgetIDR: 100_000,
      }),
    );
  });

  it("keeps the test RUNNING and does not declare a winner before the threshold is met", async () => {
    // Combined ad spend from `buildAdAccountWithTwoAds` is 100,000 — set a higher threshold and a
    // recent `startedAt` so NEITHER the spend nor the days-running threshold is met yet.
    const { testRepository, variantRepository, testId } = runningTestWithVariants({
      thresholdSpend: 500_000,
      thresholdDays: 3,
      startedAt: "2026-08-19T05:00:00.000Z",
    });
    const pullCampaignData = {
      execute: vi.fn(async () => ({ ok: true, value: buildAdAccountWithTwoAds() })),
    };
    const connector = buildFakeConnector({ pullCampaignData: pullCampaignData as never });
    const service = buildService({
      testRepository,
      variantRepository,
      connector,
      now: () => new Date("2026-08-19T06:00:00.000Z"),
    });

    const result = await service.runAbTestCheck();

    expect(result.winnersDeclared).toBe(0);
    const test = await testRepository.findById("dss-motor", testId);
    expect(test?.status).toBe("RUNNING");
  });
});
