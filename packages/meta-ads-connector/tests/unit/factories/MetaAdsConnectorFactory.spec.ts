import { createHmac } from "node:crypto";

import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { AdBuilder } from "../../../src/builders/AdBuilder.js";
import { AdSetBuilder } from "../../../src/builders/AdSetBuilder.js";
import { CampaignBuilder } from "../../../src/builders/CampaignBuilder.js";
import { parseMetaAdsConnectorConfig } from "../../../src/config/MetaAdsConnectorConfig.js";
import { AdAccount } from "../../../src/domain/entities/AdAccount.js";
import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { MetaAdsConnectorFactory } from "../../../src/factories/MetaAdsConnectorFactory.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeTracer } from "../../helpers/tracer.js";

function validConfig() {
  return unwrap(
    parseMetaAdsConnectorConfig({
      apiVersion: "v21.0",
      baseUrl: "https://graph.facebook.com",
      accessToken: "token",
      adAccountIds: ["act_1"],
      webhookVerifyToken: "verify",
      webhookAppSecret: "secret",
      tenantId: "tenant-1",
    }),
  );
}

describe("MetaAdsConnectorFactory.create", () => {
  it("wires up every documented component of the MetaAdsConnector", () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    expect(connector.syncService).toBeDefined();
    expect(connector.verdictService).toBeDefined();
    expect(connector.pullCampaignData).toBeDefined();
    expect(connector.executeVerdict).toBeDefined();
    expect(connector.processLeadWebhook).toBeDefined();
    expect(connector.registry).toBeDefined();
    expect(connector.rateLimiter).toBeDefined();
  });

  it("configures the rate limiter with the config's rateLimitPerHour", () => {
    const config = { ...validConfig(), rateLimitPerHour: 5 };
    const connector = MetaAdsConnectorFactory.create({
      config,
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    expect(connector.rateLimiter.getRateLimitStatus().remaining).toBe(5);
  });

  it("uses defaults for logger/tracer/now/fetchImpl when not provided", () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
    });
    expect(connector.registry).toBeDefined();
  });

  it("processLeadWebhook's ad resolver returns an error for a missing signature", async () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    const result = await connector.processLeadWebhook.execute({
      rawBody: JSON.stringify({ object: "page", entry: [] }),
      signature: undefined,
      webhookAppSecret: "secret",
      tenantId: "tenant-1",
      correlationId: "corr-1",
    });
    // Signature verification fails first (no signature given) — confirms the whole chain is wired.
    expect(result.ok).toBe(false);
  });

  it("processLeadWebhook's ad resolver returns an error for an unresolved ad id (registry empty, not-found branch)", async () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "ctwa_message",
              value: { ad_id: "unregistered-ad", waba_id: "w1", phone_number: "+1" },
            },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac("sha256", "secret").update(body, "utf8").digest("hex")}`;
    const result = await connector.processLeadWebhook.execute({
      rawBody: body,
      signature,
      webhookAppSecret: "secret",
      tenantId: "tenant-1",
      correlationId: "corr-1",
    });
    // Signature verifies and the payload parses fine, so this exercises `resolveAd`'s `found.some
    // ? ... : err(...)` not-found branch specifically (the registry has no synced ads at all).
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/No synced ad found/);
    }
  });

  it("processLeadWebhook's ad resolver resolves a synced ad id via the registry (found branch)", async () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    const adAccountId = unwrap(AdAccountId.create("act_1"));
    const ad = unwrap(new AdBuilder().withAdAccountId(adAccountId).withMetaId("meta-ad-1").build());
    const adSet = unwrap(new AdSetBuilder().withAdAccountId(adAccountId).withAds([ad]).build());
    const campaign = unwrap(
      new CampaignBuilder().withAdAccountId(adAccountId).withAdSets([adSet]).build(),
    );
    const account = unwrap(
      AdAccount.create({
        id: adAccountId,
        name: "Test Account",
        businessManagerId: "bm_1",
        currency: "IDR",
        timezone: "Asia/Jakarta",
        campaigns: [campaign],
        syncedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    );
    connector.registry.save(account);

    const body = JSON.stringify({
      object: "page",
      entry: [
        {
          id: "e1",
          changes: [
            {
              field: "ctwa_message",
              value: { ad_id: "meta-ad-1", waba_id: "w1", phone_number: "+1" },
            },
          ],
        },
      ],
    });
    const signature = `sha256=${createHmac("sha256", "secret").update(body, "utf8").digest("hex")}`;

    const result = await connector.processLeadWebhook.execute({
      rawBody: body,
      signature,
      webhookAppSecret: "secret",
      tenantId: "tenant-1",
      correlationId: "corr-2",
    });
    // The ad id was registered via `registry.save`, so `resolveAd`'s `found.some` branch resolves
    // it to internal AAOS ids and the lead is processed successfully.
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toHaveLength(1);
  });

  it("registry starts empty for a freshly created connector", () => {
    const connector = MetaAdsConnectorFactory.create({
      config: validConfig(),
      publisher: createFakePublisher(),
      logger: createMockLogger() as never,
      tracer: createFakeTracer(),
    });
    expect(connector.registry.findById(unwrap(AdAccountId.create("act_1"))).some).toBe(false);
  });
});
