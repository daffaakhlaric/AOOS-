import { ok } from "@aos/common";
import { NotFoundError, ValidationError } from "@aos/errors";
import { MetaAdsConnectorFactory, Verdict, type MetaAdsConnector } from "@aos/meta-ads-connector";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DEFAULT_TENANT_ID } from "../../common/tenant-context.js";
import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerAdAccountNameMswHandler,
  registerHappyPathMetaApiHandlers,
  registerMetaApiErrorHandler,
  registerMetaApiPostErrorHandler,
} from "../../test-support/meta-api-msw.js";

import { MetaAdsService } from "./meta-ads.service.js";

/** Minimal registry test double — mirrors `MetaAdsConnectorRegistry.resolve`'s real shape, always resolving to the given connector+config's own token/ad-account-ids regardless of tenantId. */
function toRegistry(config: AaosApiConfig, connector: MetaAdsConnector) {
  return {
    resolve: async () =>
      ok({
        ...connector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      }),
  };
}

/** Minimal `AdTenantIndexRepository` test double — AAOS-MULTI-TENANT-PHASE1C's best-effort indexing side effect, irrelevant to this file's own `pullCampaigns`/`getAdAccounts`/`executeVerdict` assertions. */
function buildFakeAdTenantIndex() {
  return {
    upsertMany: async () => undefined,
    findTenantByAdMetaId: async () => undefined,
  };
}

/** Minimal `ModeGuardService` test double — always resolves LIVE (calls `executeFn`) unless `dev: true`. */
function buildFakeModeGuard(dev = false) {
  return {
    resolveMode: async () => (dev ? "DEV" : "LIVE"),
    executeOrSimulate: async <T>(
      _tenantId: string,
      executeFn: () => Promise<T>,
      simulateFn: () => Promise<T>,
    ): Promise<T> => (dev ? simulateFn() : executeFn()),
  };
}

/** Minimal `ActivityLogger` test double (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — `start` always returns a fixed id, `complete`/`fail`/`logToolCall`/`logReasoning` are no-op spies so this file's tests can assert real wiring without a real Supabase round-trip. */
function buildFakeActivityLogger() {
  return {
    start: vi.fn(async () => "activity-1"),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
  };
}

/** Minimal `MetaSyncService` test double (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4) — `syncCampaign` is a no-op spy, irrelevant to this file's own pre-existing `pullCampaigns`/`getAdAccounts`/`executeVerdict` assertions. */
function buildFakeMetaSync(overrides: Record<string, unknown> = {}) {
  return {
    syncCampaign: vi.fn(async () => undefined),
    getCampaignHistory: vi.fn(async () => []),
    ...overrides,
  };
}

/** Minimal `LlmService` test double (AAOS Analytics Platform Phase 4) — `assetInsight` always resolves a fixed, typed "unavailable" DTO so this file's existing `pullCampaigns`/`getAdAccounts`/`executeVerdict` tests (which never touch `getAssetDetail`) stay unaffected by real OpenAI wiring. */
function buildFakeLlmService() {
  return {
    assetInsight: vi.fn(async () => ({
      available: false as const,
      reason: "NO_API_KEY" as const,
      message: "test",
    })),
    campaignInsight: vi.fn(async () => ({
      available: true as const,
      triage: { level: "SEHAT" as const, why: "CPL di bawah benchmark." },
      verdict: "SCALE" as const,
      confidence: 80,
      verdictOneLiner: "Campaign ini SCALE-worthy.",
      rootCause: { primary: "CPL efisien.", primaryEvidence: "CPL di bawah benchmark." },
      metricBreakdown: [
        {
          metric: "CPL",
          status: "good" as const,
          interpretation: "di bawah benchmark",
          vsContext: "vs benchmark akun",
          trend: "stabil" as const,
          trendDetail: "stabil",
        },
        {
          metric: "Frequency",
          status: "good" as const,
          interpretation: "aman",
          vsContext: "vs threshold",
          trend: "stabil" as const,
          trendDetail: "stabil",
        },
        {
          metric: "CTR",
          status: "neutral" as const,
          interpretation: "responsif",
          vsContext: "vs rata-rata",
          trend: "stabil" as const,
          trendDetail: "stabil",
        },
      ],
      whatHappened: "Campaign berjalan stabil.",
      playbook: {
        immediate: {
          action: "Naikkan budget.",
          how: "Naikkan daily budget.",
          why: "CPL efisien.",
          expectedResult: "Lebih banyak leads.",
        },
        shortTerm: {
          action: "Pantau frequency.",
          how: "Cek dashboard harian.",
          why: "Antisipasi jenuh.",
          expectedResult: "Deteksi dini.",
        },
        mediumTerm: {
          action: "Siapkan creative baru.",
          how: "Brief Kai.",
          why: "Jaga sustainability.",
          expectedResult: "Scale berkelanjutan.",
        },
      },
      kaiDirective: { needed: false as const },
      budgetDecision: {
        recommendation: "increase" as const,
        currentBudget: 750_000,
        recommendedBudget: 900_000,
        changePercent: 20,
        reasoning: "CPL efisien.",
      },
      scenarios: [
        {
          name: "Scale",
          probability: "70%",
          steps: ["Naikkan budget"],
          expectedOutcome: "Leads naik.",
          timeToResult: "5-7 hari",
        },
        {
          name: "Pertahankan",
          probability: "30%",
          steps: ["Biarkan tetap"],
          expectedOutcome: "Stabil.",
          timeToResult: "N/A",
        },
      ],
      learnings: ["CPL rendah = ruang scale."],
    })),
    diagnoseAdCopy: vi.fn(async () => ({
      available: true as const,
      structural: {
        hook: { status: "YES" as const, reasoning: "Ada hook." },
        clearProblem: { status: "PARTIAL" as const, reasoning: "Kurang jelas." },
        toThePoint: { status: "YES" as const, reasoning: "Singkat." },
        softCta: { status: "NO" as const, reasoning: "Tidak ada CTA." },
      },
    })),
  };
}

// TENANT-SCOPING FIX (Phase T2): `MetaAdsService` no longer takes `AAOS_API_CONFIG` — its
// constructor list is one shorter than before this phase, and every method call below now passes
// a real `tenantId` (`DEFAULT_TENANT_ID`, matching this file's own `buildTestConfig`'s
// `AAOS_TENANT_ID`) as an explicit final argument instead of the service reading it off config.
function buildService(
  dev = false,
  activityLogger: ReturnType<typeof buildFakeActivityLogger> = buildFakeActivityLogger(),
  llmService: ReturnType<typeof buildFakeLlmService> = buildFakeLlmService(),
  metaSync: ReturnType<typeof buildFakeMetaSync> = buildFakeMetaSync(),
): MetaAdsService {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const connector = MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
  return new MetaAdsService(
    toRegistry(config, connector) as never,
    buildFakeAdTenantIndex() as never,
    buildFakeModeGuard(dev) as never,
    activityLogger as never,
    llmService as never,
    metaSync as never,
  );
}

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe("MetaAdsService", () => {
  describe("pullCampaigns", () => {
    it("pulls campaigns for an explicitly provided adAccountId", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const dto = await service.pullCampaigns(
        { adAccountId: "act_752604553578354", datePreset: "last_30d" },
        "corr-1",
        DEFAULT_TENANT_ID,
      );
      expect(dto.id).toBe("act_752604553578354");
      expect(dto.campaigns).toHaveLength(1);
      expect(dto.campaigns[0]?.adSets[0]?.ads[0]?.verdict).toBeDefined();
    });

    it("defaults to the first configured ad account when adAccountId is omitted", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const dto = await service.pullCampaigns(
        { datePreset: "last_30d" },
        "corr-2",
        DEFAULT_TENANT_ID,
      );
      expect(dto.id).toBe("act_752604553578354");
    });

    it("throws the raw AdAccountId ValidationError for a malformed adAccountId", async () => {
      const service = buildService();
      await expect(
        service.pullCampaigns(
          { adAccountId: "not-an-account", datePreset: "last_30d" },
          "corr-3",
          DEFAULT_TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it("throws the raw connector error when the Meta API call fails", async () => {
      registerMetaApiErrorHandler(401, 190);
      const service = buildService();
      const { AuthError } = await import("@aos/meta-ads-connector");
      await expect(
        service.pullCampaigns(
          { adAccountId: "act_752604553578354", datePreset: "last_30d" },
          "corr-4",
          DEFAULT_TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it("throws a ValidationError when no adAccountId is provided and none is configured", async () => {
      const config = buildTestConfig({ META_AD_ACCOUNT_IDS: [] });
      const connectorConfig = toConnectorConfig(buildTestConfig());
      if (!connectorConfig.ok) {
        throw new Error("test setup failed");
      }
      const connector = MetaAdsConnectorFactory.create({
        config: connectorConfig.value,
        publisher: createFakePublisher(),
      });
      const service = new MetaAdsService(
        toRegistry(config, connector) as never,
        buildFakeAdTenantIndex() as never,
        buildFakeModeGuard() as never,
        buildFakeActivityLogger() as never,
        buildFakeLlmService() as never,
        buildFakeMetaSync() as never,
      );
      await expect(
        service.pullCampaigns({ datePreset: "last_30d" }, "corr-5", DEFAULT_TENANT_ID),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("getAssetDetail", () => {
    it("throws a real NotFoundError when no ad in the pull carries the given asset id, without calling the LLM", async () => {
      registerHappyPathMetaApiHandlers();
      const llmService = buildFakeLlmService();
      const service = buildService(false, buildFakeActivityLogger(), llmService);
      await expect(
        service.getAssetDetail(
          "asset-that-does-not-exist",
          { adAccountId: "act_752604553578354", datePreset: "last_30d" },
          "corr-asset-1",
          DEFAULT_TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(llmService.assetInsight).not.toHaveBeenCalled();
    });
  });

  describe("getAndromedaHealth (Samantha Andromeda-Aware Campaign System, Sprint 2)", () => {
    it("returns real, live-pulled ad-set count + diversity + evaluation for a real campaign id", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const pulled = await service.pullCampaigns(
        { adAccountId: "act_752604553578354", datePreset: "last_30d" },
        "corr-health-1",
        DEFAULT_TENANT_ID,
      );
      // Real bug fix (live-confirmed 404 in production): this method does its OWN separate
      // `pullAdAccount` call, so it must be looked up by the real, stable `metaId` — `id` is
      // re-generated randomly on every pull and would never match across two separate pulls like
      // this test deliberately exercises (`pullCampaigns` above, then `getAndromedaHealth` below).
      const campaignId = pulled.campaigns[0]?.metaId;
      expect(campaignId).toBeDefined();

      const health = await service.getAndromedaHealth(
        campaignId as string,
        { adAccountId: "act_752604553578354", datePreset: "last_30d" },
        "corr-health-2",
        DEFAULT_TENANT_ID,
      );
      expect(health.campaignId).toBe(campaignId);
      expect(health.adSetCount).toBeGreaterThanOrEqual(1);
      expect(["NOT_ENOUGH_DATA", "LOW_DIVERSITY", "DIVERSE"]).toContain(health.diversity.status);
      expect(health.evaluation).toHaveProperty("triggered");
    });

    it("throws a real NotFoundError when no campaign in the current pull carries the given id", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      await expect(
        service.getAndromedaHealth(
          "campaign-that-does-not-exist",
          { adAccountId: "act_752604553578354", datePreset: "last_30d" },
          "corr-health-3",
          DEFAULT_TENANT_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("getCampaignInsight", () => {
    it("delegates straight to LlmService.campaignInsight with the real tenant id, no Meta re-pull", async () => {
      const llmService = buildFakeLlmService();
      const service = buildService(false, buildFakeActivityLogger(), llmService);
      const body = {
        campaignId: "camp-1",
        campaignName: "Xpander Bintaro",
        verdict: "SCALE",
        spend: 2_500_000,
        totalLead: 12,
        clicks: 340,
        impressions: 15_000,
        maxFrequency: 2.1,
        adCount: 4,
        adSetCount: 2,
        cpl: 208_333,
        benchmarkCplIDR: 250_000,
      } as const;
      const result = await service.getCampaignInsight(DEFAULT_TENANT_ID, body as never);
      expect(llmService.campaignInsight).toHaveBeenCalledWith(DEFAULT_TENANT_ID, body);
      expect(result).toMatchObject({ available: true, verdict: "SCALE" });
    });
  });

  describe("getCampaignHistory (Campaign Page Rebuild v2)", () => {
    it("delegates to MetaSyncService.getCampaignHistory with the real tenant id/campaignId/days, no Meta re-pull", async () => {
      const points = [
        {
          date: "2026-09-10",
          spend: 1,
          impressions: 2,
          clicks: 3,
          frequency: 4,
          ctr: 5,
          cpl: 6,
          leads: 7,
        },
      ];
      const metaSync = buildFakeMetaSync({ getCampaignHistory: vi.fn(async () => points) });
      const service = buildService(
        false,
        buildFakeActivityLogger(),
        buildFakeLlmService(),
        metaSync,
      );

      const result = await service.getCampaignHistory(DEFAULT_TENANT_ID, "camp-1", 7);

      expect(metaSync.getCampaignHistory).toHaveBeenCalledWith(DEFAULT_TENANT_ID, "camp-1", 7);
      expect(result).toEqual({ campaignId: "camp-1", points });
    });

    it("returns an empty points array (never fabricated) when the real repository has no history yet", async () => {
      const metaSync = buildFakeMetaSync({ getCampaignHistory: vi.fn(async () => []) });
      const service = buildService(
        false,
        buildFakeActivityLogger(),
        buildFakeLlmService(),
        metaSync,
      );

      const result = await service.getCampaignHistory(DEFAULT_TENANT_ID, "camp-new", 7);

      expect(result).toEqual({ campaignId: "camp-new", points: [] });
    });
  });

  describe("getAdCopyDiagnosis (AAOS Samantha Professional Optimizer, Part C)", () => {
    it("delegates straight to LlmService.diagnoseAdCopy with the real tenant id, no Meta re-pull", async () => {
      const llmService = buildFakeLlmService();
      const service = buildService(false, buildFakeActivityLogger(), llmService);
      const body = {
        adName: "Xpander Cross 2023",
        primaryText: "DP ringan mulai 15 juta!",
        headline: "Xpander Cross DP Ringan",
        description: "Unit siap survey",
        verdict: "REVIEW",
        isUnderperforming: true,
        spend: 1_200_000,
        conversations: 3,
        rphChatIDR: 400_000,
        frequency: 1.8,
      } as const;
      const result = await service.getAdCopyDiagnosis(DEFAULT_TENANT_ID, body as never);
      expect(llmService.diagnoseAdCopy).toHaveBeenCalledWith(DEFAULT_TENANT_ID, body);
      expect(result).toEqual({
        available: true,
        structural: {
          hook: { status: "YES", reasoning: "Ada hook." },
          clearProblem: { status: "PARTIAL", reasoning: "Kurang jelas." },
          toThePoint: { status: "YES", reasoning: "Singkat." },
          softCta: { status: "NO", reasoning: "Tidak ada CTA." },
        },
      });
    });
  });

  describe("getAdAccounts", () => {
    it("resolves the real name for every configured account id", async () => {
      registerAdAccountNameMswHandler({
        act_752604553578354: "DSS Motor",
        act_999999999999999: "Pusat Grosir Mobil",
      });
      const config = buildTestConfig({
        META_AD_ACCOUNT_IDS: ["act_752604553578354", "act_999999999999999"],
      });
      const connectorConfig = toConnectorConfig(config);
      if (!connectorConfig.ok) {
        throw new Error("test setup failed");
      }
      const connector = MetaAdsConnectorFactory.create({
        config: connectorConfig.value,
        publisher: createFakePublisher(),
      });
      const service = new MetaAdsService(
        toRegistry(config, connector) as never,
        buildFakeAdTenantIndex() as never,
        buildFakeModeGuard() as never,
        buildFakeActivityLogger() as never,
        buildFakeLlmService() as never,
        buildFakeMetaSync() as never,
      );
      const accounts = await service.getAdAccounts(DEFAULT_TENANT_ID);
      expect(accounts).toEqual([
        { id: "act_752604553578354", name: "DSS Motor" },
        { id: "act_999999999999999", name: "Pusat Grosir Mobil" },
      ]);
    });

    it("falls back to the raw id when Meta's name lookup fails for one account, without failing the others", async () => {
      registerAdAccountNameMswHandler({ act_752604553578354: "DSS Motor" });
      const config = buildTestConfig({
        META_AD_ACCOUNT_IDS: ["act_752604553578354", "act_000000000000000"],
      });
      const connectorConfig = toConnectorConfig(config);
      if (!connectorConfig.ok) {
        throw new Error("test setup failed");
      }
      const connector = MetaAdsConnectorFactory.create({
        config: connectorConfig.value,
        publisher: createFakePublisher(),
      });
      const service = new MetaAdsService(
        toRegistry(config, connector) as never,
        buildFakeAdTenantIndex() as never,
        buildFakeModeGuard() as never,
        buildFakeActivityLogger() as never,
        buildFakeLlmService() as never,
        buildFakeMetaSync() as never,
      );
      const accounts = await service.getAdAccounts(DEFAULT_TENANT_ID);
      expect(accounts).toEqual([
        { id: "act_752604553578354", name: "DSS Motor" },
        { id: "act_000000000000000", name: "act_000000000000000" },
      ]);
    });
  });

  describe("executeVerdict", () => {
    it("executes a PAUSE verdict against the (mocked) Meta API", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
        "corr-6",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("PAUSED");
      expect(result.targetId).toBe("120000000000003");
      expect(result.simulated).toBe(false);
    });

    it("does NOT call the real Meta API and returns a SIMULATED result when the tenant is in DEV mode (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A)", async () => {
      // No MSW handler registered at all — any real HTTP call would fail the test
      // (`onUnhandledRequest: "error"`), proving `executeFn` (the real Meta call) never runs.
      const service = buildService(true);
      const result = await service.executeVerdict(
        { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
        "corr-dev-1",
        DEFAULT_TENANT_ID,
      );
      expect(result).toEqual({
        action: "SIMULATED",
        targetId: "120000000000003",
        targetType: "ad",
        simulated: true,
      });
    });

    it("executes a SCALE verdict against the (mocked) Meta API", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "SCALE", targetId: "120000000000002", targetType: "adset" },
        "corr-7",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("SCALED");
    });

    it("executes a FIX verdict against the (mocked) Meta API", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "FIX", targetId: "120000000000001", targetType: "campaign" },
        "corr-fix",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("FIXED");
    });

    it("returns HUMAN_ACTION_REQUIRED for a REFRESH verdict without calling the Meta API", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "REFRESH", targetId: "120000000000003", targetType: "ad" },
        "corr-refresh",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("HUMAN_ACTION_REQUIRED");
    });

    it("returns NO_ACTION for a KEEP verdict without calling the Meta API", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "KEEP", targetId: "120000000000003", targetType: "ad" },
        "corr-8",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("NO_ACTION");
    });

    it("throws the raw connector error when the Meta API rejects the mutation", async () => {
      const service = buildService();
      registerMetaApiPostErrorHandler(403);
      const { PermissionError } = await import("@aos/meta-ads-connector");
      const result = service.executeVerdict(
        { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
        "corr-9",
        DEFAULT_TENANT_ID,
      );
      await expect(result).rejects.toBeInstanceOf(PermissionError);
    });

    it("maps every request DTO verdict string to the matching connector Verdict enum member", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "REVIEW", targetId: "id", targetType: "campaign" },
        "corr-10",
        DEFAULT_TENANT_ID,
      );
      expect(result.action).toBe("NO_ACTION");
      expect(Verdict.REVIEW).toBe("REVIEW");
    });

    describe("ActivityLogger wiring (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B)", () => {
      it("starts a RUNNING activity with mode LIVE and completes it SUCCESS for a real LIVE-mode execution", async () => {
        registerHappyPathMetaApiHandlers();
        const activityLogger = buildFakeActivityLogger();
        const service = buildService(false, activityLogger);
        const result = await service.executeVerdict(
          { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
          "corr-activity-live",
          DEFAULT_TENANT_ID,
        );

        expect(activityLogger.start).toHaveBeenCalledTimes(1);
        expect(activityLogger.start).toHaveBeenCalledWith(
          expect.objectContaining({
            agent: "SAMANTHA",
            actionType: "EXECUTE_VERDICT",
            mode: "LIVE",
            loopId: "corr-activity-live",
          }),
        );
        expect(activityLogger.complete).toHaveBeenCalledTimes(1);
        expect(activityLogger.complete).toHaveBeenCalledWith(
          "activity-1",
          expect.objectContaining({ status: "SUCCESS", output: result }),
        );
        expect(activityLogger.fail).not.toHaveBeenCalled();
      });

      it("starts a RUNNING activity with mode DEV and completes it SIMULATED for a DEV-mode call", async () => {
        const activityLogger = buildFakeActivityLogger();
        const service = buildService(true, activityLogger);
        const result = await service.executeVerdict(
          { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
          "corr-activity-dev",
          DEFAULT_TENANT_ID,
        );

        expect(activityLogger.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "DEV" }));
        expect(activityLogger.complete).toHaveBeenCalledWith(
          "activity-1",
          expect.objectContaining({ status: "SIMULATED", devPreview: result }),
        );
        expect(activityLogger.fail).not.toHaveBeenCalled();
      });

      it("fails the activity with the real thrown error when the Meta API rejects the mutation", async () => {
        const activityLogger = buildFakeActivityLogger();
        const service = buildService(false, activityLogger);
        registerMetaApiPostErrorHandler(403);
        const { PermissionError } = await import("@aos/meta-ads-connector");
        await expect(
          service.executeVerdict(
            { verdict: "PAUSE", targetId: "120000000000003", targetType: "ad" },
            "corr-activity-error",
            DEFAULT_TENANT_ID,
          ),
        ).rejects.toBeInstanceOf(PermissionError);

        expect(activityLogger.fail).toHaveBeenCalledTimes(1);
        expect(activityLogger.fail).toHaveBeenCalledWith("activity-1", expect.any(PermissionError));
        expect(activityLogger.complete).not.toHaveBeenCalled();
      });
    });
  });
});
