import { createHmac } from "node:crypto";

import { MetaAdsConnectorFactory, WebhookVerifier } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { toConnectorConfig } from "../../config/to-connector-config.js";
import { createFakePublisher, type FakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { WebhookService } from "./webhook.service.js";

function buildService(): { service: WebhookService; publisher: FakePublisher } {
  const config = buildTestConfig();
  const connectorConfig = toConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const publisher = createFakePublisher();
  const connector = MetaAdsConnectorFactory.create({ config: connectorConfig.value, publisher });
  const service = new WebhookService(config, connector, new WebhookVerifier());
  return { service, publisher };
}

describe("WebhookService", () => {
  describe("verifyHandshake", () => {
    it("returns ok(challenge) for a valid subscribe handshake", () => {
      const { service } = buildService();
      const result = service.verifyHandshake("subscribe", "test-verify-token", "challenge-xyz");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("challenge-xyz");
      }
    });

    it("returns err(TokenVerificationError) for a wrong verify token", () => {
      const { service } = buildService();
      const result = service.verifyHandshake("subscribe", "wrong-token", "challenge-xyz");
      expect(result.ok).toBe(false);
    });

    it("returns err(TokenVerificationError) for a non-subscribe mode", () => {
      const { service } = buildService();
      const result = service.verifyHandshake("unsubscribe", "test-verify-token", "challenge-xyz");
      expect(result.ok).toBe(false);
    });

    it("returns err(TokenVerificationError) when the challenge is missing", () => {
      const { service } = buildService();
      const result = service.verifyHandshake("subscribe", "test-verify-token", undefined);
      expect(result.ok).toBe(false);
    });
  });

  describe("processLeadWebhook", () => {
    it("throws the raw WebhookError when signature verification fails", async () => {
      const { service } = buildService();
      await expect(service.processLeadWebhook("{}", undefined, "corr-1")).rejects.toMatchObject({
        name: "SignatureVerificationError",
      });
    });

    it("throws a PayloadParseError when the signature is valid but the payload fails schema validation", async () => {
      const config = buildTestConfig();
      const { service } = buildService();
      const rawBody = JSON.stringify({ not: "a valid webhook payload" });
      const signature = `sha256=${createHmac("sha256", config.META_WEBHOOK_APP_SECRET).update(rawBody, "utf8").digest("hex")}`;
      await expect(service.processLeadWebhook(rawBody, signature, "corr-2")).rejects.toMatchObject({
        name: "PayloadParseError",
      });
    });

    it("publishes no event through the injected publisher when processing fails", async () => {
      const { service, publisher } = buildService();
      await service.processLeadWebhook("{}", undefined, "corr-3").catch(() => undefined);
      expect(publisher.published).toHaveLength(0);
    });
  });
});
