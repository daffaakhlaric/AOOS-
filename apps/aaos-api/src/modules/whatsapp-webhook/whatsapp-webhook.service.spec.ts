import { WebhookVerifier, WhatsAppConnectorFactory } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { toWhatsAppConnectorConfig } from "../../config/to-whatsapp-connector-config.js";
import { createFakePublisher, type FakePublisher } from "../../test-support/fake-publisher.js";
import { buildTestConfig } from "../../test-support/fixtures.js";

import { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

function buildService(): { service: WhatsAppWebhookService; publisher: FakePublisher } {
  const config = buildTestConfig();
  const connectorConfig = toWhatsAppConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const publisher = createFakePublisher();
  const connector = WhatsAppConnectorFactory.create({ config: connectorConfig.value, publisher });
  const service = new WhatsAppWebhookService(config, connector, new WebhookVerifier());
  return { service, publisher };
}

describe("WhatsAppWebhookService", () => {
  describe("verifyHandshake", () => {
    it("returns ok(challenge) for a valid subscribe handshake", () => {
      const { service } = buildService();
      const result = service.verifyHandshake(
        "subscribe",
        "test-whatsapp-verify-token",
        "challenge-xyz",
      );
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
      const result = service.verifyHandshake(
        "unsubscribe",
        "test-whatsapp-verify-token",
        "challenge-xyz",
      );
      expect(result.ok).toBe(false);
    });
  });

  describe("processIncomingWebhookAsync", () => {
    it("never throws, even when signature verification fails", async () => {
      const { service } = buildService();
      await expect(
        service.processIncomingWebhookAsync("{}", undefined, "corr-1"),
      ).resolves.toBeUndefined();
    });

    it("never throws, even when the payload fails schema validation", async () => {
      const { service } = buildService();
      await expect(
        service.processIncomingWebhookAsync("{not json", undefined, "corr-2"),
      ).resolves.toBeUndefined();
    });

    it("publishes MessageReceived for a valid signed text message payload", async () => {
      const { createHmac } = await import("node:crypto");
      const config = buildTestConfig();
      const { service, publisher } = buildService();
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-entry-1",
            changes: [
              {
                field: "messages",
                value: {
                  messaging_product: "whatsapp",
                  metadata: {
                    display_phone_number: config.PHONE_NUMBER_BINTARO,
                    phone_number_id: config.PHONE_NUMBER_ID_BINTARO,
                  },
                  messages: [
                    {
                      from: "628123456789",
                      id: "wamid.svc1",
                      timestamp: "1700000000",
                      type: "text",
                      text: { body: "Halo kak" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", config.WHATSAPP_WEBHOOK_APP_SECRET).update(rawBody, "utf8").digest("hex")}`;

      await service.processIncomingWebhookAsync(rawBody, signature, "corr-3");

      expect(publisher.published.some((e) => e.type === "aaos.whatsapp.message.received")).toBe(
        true,
      );
    });
  });
});
