import { ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch, Funnel, MetaAdsConnectorFactory } from "@aos/meta-ads-connector";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerCreateCampaignErrorHandler,
  registerCreateCampaignMswHandlers,
} from "../../test-support/meta-api-msw.js";

import { CampaignsService } from "./campaigns.service.js";

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

/** Minimal `ActivityLogger` test double (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B) — mirrors `meta-ads.service.spec.ts`'s own fake. */
function buildFakeActivityLogger() {
  return {
    start: vi.fn(async () => "activity-1"),
    complete: vi.fn(async () => undefined),
    fail: vi.fn(async () => undefined),
    logToolCall: vi.fn(async () => undefined),
    logReasoning: vi.fn(async () => undefined),
  };
}

function buildService(
  dev = false,
  activityLogger: ReturnType<typeof buildFakeActivityLogger> = buildFakeActivityLogger(),
): CampaignsService {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const connector = MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
  const registry = {
    resolve: async () =>
      ok({
        ...connector,
        accessToken: config.META_ACCESS_TOKEN,
        adAccountIds: config.META_AD_ACCOUNT_IDS,
      }),
  };
  return new CampaignsService(
    config,
    registry as never,
    buildFakeModeGuard(dev) as never,
    activityLogger as never,
  );
}

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

describe("CampaignsService.createCampaign (AAOS-W1D-S3)", () => {
  it("creates a campaign + adset and returns the new campaignId/adSetId", async () => {
    registerCreateCampaignMswHandlers({
      newCampaignId: "120000000000099",
      newAdSetId: "120000000000100",
    });
    const service = buildService();
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
      },
      "corr-1",
    );
    expect(dto.campaignId).toBe("120000000000099");
    expect(dto.adSetId).toBe("120000000000100");
    expect(dto.simulated).toBe(false);
  });

  it("does NOT call the real Meta API and returns simulated:true with no ids when the tenant is in DEV mode (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A)", async () => {
    // No MSW handler registered at all — any real HTTP call would fail the test
    // (`onUnhandledRequest: "error"`), proving `executeFn` (the real Meta call) never runs.
    const service = buildService(true);
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Meta-CTWA-Leads-Mobix-Cinere",
        branch: Branch.CINERE,
        funnel: Funnel.CTWA,
      },
      "corr-dev-1",
    );
    expect(dto).toEqual({ simulated: true });
  });

  it("passes through an explicit dailyBudgetIDR override", async () => {
    registerCreateCampaignMswHandlers();
    const service = buildService();
    const dto = await service.createCampaign(
      {
        adAccountId: "act_752604553578354",
        name: "Custom Budget",
        branch: Branch.BINTARO,
        funnel: Funnel.CTWA,
        dailyBudgetIDR: 250_000,
      },
      "corr-2",
    );
    expect(dto.campaignId).toBeDefined();
  });

  it("throws the raw AdAccountId ValidationError for a malformed adAccountId", async () => {
    const service = buildService();
    await expect(
      service.createCampaign(
        {
          adAccountId: "not-an-account",
          name: "Bad Account",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-3",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws the raw connector error when Meta rejects the campaign creation", async () => {
    registerCreateCampaignErrorHandler(400, 100);
    const service = buildService();
    const { MetaApiError } = await import("@aos/meta-ads-connector");
    await expect(
      service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Will Fail",
          branch: Branch.UMUM,
          funnel: Funnel.CTWA,
        },
        "corr-4",
      ),
    ).rejects.toBeInstanceOf(MetaApiError);
  });

  describe("ActivityLogger wiring (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B)", () => {
    it("starts a RUNNING activity with mode LIVE and completes it SUCCESS for a real creation", async () => {
      registerCreateCampaignMswHandlers({
        newCampaignId: "120000000000099",
        newAdSetId: "120000000000100",
      });
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      const dto = await service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Meta-CTWA-Leads-Mobix-Cinere",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-activity-live",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: "SAMANTHA",
          actionType: "CREATE_CAMPAIGN",
          mode: "LIVE",
          loopId: "corr-activity-live",
        }),
      );
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SUCCESS", output: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("starts a RUNNING activity with mode DEV and completes it SIMULATED for a DEV-mode call", async () => {
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(true, activityLogger);
      const dto = await service.createCampaign(
        {
          adAccountId: "act_752604553578354",
          name: "Meta-CTWA-Leads-Mobix-Cinere",
          branch: Branch.CINERE,
          funnel: Funnel.CTWA,
        },
        "corr-activity-dev",
      );

      expect(activityLogger.start).toHaveBeenCalledWith(expect.objectContaining({ mode: "DEV" }));
      expect(activityLogger.complete).toHaveBeenCalledWith(
        "activity-1",
        expect.objectContaining({ status: "SIMULATED", devPreview: dto }),
      );
      expect(activityLogger.fail).not.toHaveBeenCalled();
    });

    it("fails the activity with the real thrown error when Meta rejects the campaign creation", async () => {
      registerCreateCampaignErrorHandler(400, 100);
      const activityLogger = buildFakeActivityLogger();
      const service = buildService(false, activityLogger);
      const { MetaApiError } = await import("@aos/meta-ads-connector");
      await expect(
        service.createCampaign(
          {
            adAccountId: "act_752604553578354",
            name: "Will Fail",
            branch: Branch.UMUM,
            funnel: Funnel.CTWA,
          },
          "corr-activity-error",
        ),
      ).rejects.toBeInstanceOf(MetaApiError);

      expect(activityLogger.fail).toHaveBeenCalledWith("activity-1", expect.any(MetaApiError));
      expect(activityLogger.complete).not.toHaveBeenCalled();
    });
  });
});
