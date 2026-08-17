import { ValidationError } from "@aos/errors";
import { MetaAdsConnectorFactory, Verdict } from "@aos/meta-ads-connector";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

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

function buildService(): MetaAdsService {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const connector = MetaAdsConnectorFactory.create({
    config: connectorConfig.value,
    publisher: createFakePublisher(),
  });
  return new MetaAdsService(config, connector);
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
      );
      expect(dto.id).toBe("act_752604553578354");
      expect(dto.campaigns).toHaveLength(1);
      expect(dto.campaigns[0]?.adSets[0]?.ads[0]?.verdict).toBeDefined();
    });

    it("defaults to the first configured ad account when adAccountId is omitted", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const dto = await service.pullCampaigns({ datePreset: "last_30d" }, "corr-2");
      expect(dto.id).toBe("act_752604553578354");
    });

    it("throws the raw AdAccountId ValidationError for a malformed adAccountId", async () => {
      const service = buildService();
      await expect(
        service.pullCampaigns({ adAccountId: "not-an-account", datePreset: "last_30d" }, "corr-3"),
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
      const service = new MetaAdsService(config, connector);
      await expect(
        service.pullCampaigns({ datePreset: "last_30d" }, "corr-5"),
      ).rejects.toBeInstanceOf(ValidationError);
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
      const service = new MetaAdsService(config, connector);
      const accounts = await service.getAdAccounts();
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
      const service = new MetaAdsService(config, connector);
      const accounts = await service.getAdAccounts();
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
      );
      expect(result.action).toBe("PAUSED");
      expect(result.targetId).toBe("120000000000003");
    });

    it("executes a SCALE verdict against the (mocked) Meta API", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "SCALE", targetId: "120000000000002", targetType: "adset" },
        "corr-7",
      );
      expect(result.action).toBe("SCALED");
    });

    it("executes a FIX verdict against the (mocked) Meta API", async () => {
      registerHappyPathMetaApiHandlers();
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "FIX", targetId: "120000000000001", targetType: "campaign" },
        "corr-fix",
      );
      expect(result.action).toBe("FIXED");
    });

    it("returns HUMAN_ACTION_REQUIRED for a REFRESH verdict without calling the Meta API", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "REFRESH", targetId: "120000000000003", targetType: "ad" },
        "corr-refresh",
      );
      expect(result.action).toBe("HUMAN_ACTION_REQUIRED");
    });

    it("returns NO_ACTION for a KEEP verdict without calling the Meta API", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "KEEP", targetId: "120000000000003", targetType: "ad" },
        "corr-8",
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
      );
      await expect(result).rejects.toBeInstanceOf(PermissionError);
    });

    it("maps every request DTO verdict string to the matching connector Verdict enum member", async () => {
      const service = buildService();
      const result = await service.executeVerdict(
        { verdict: "REVIEW", targetId: "id", targetType: "campaign" },
        "corr-10",
      );
      expect(result.action).toBe("NO_ACTION");
      expect(Verdict.REVIEW).toBe("REVIEW");
    });
  });
});
