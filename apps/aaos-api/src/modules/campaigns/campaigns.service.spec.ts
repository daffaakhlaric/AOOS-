import { ok } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { Branch, Funnel, MetaAdsConnectorFactory } from "@aos/meta-ads-connector";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import {
  mswServer,
  registerCreateCampaignErrorHandler,
  registerCreateCampaignMswHandlers,
} from "../../test-support/meta-api-msw.js";

import { CampaignsService } from "./campaigns.service.js";

function buildService(): CampaignsService {
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
  return new CampaignsService(config, registry as never);
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
});
