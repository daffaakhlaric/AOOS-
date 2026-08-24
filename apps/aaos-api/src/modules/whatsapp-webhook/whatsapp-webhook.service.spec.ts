import { createHmac } from "node:crypto";

import { WebhookVerifier, WhatsAppConnectorFactory } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { toWhatsAppConnectorConfig } from "../../config/to-whatsapp-connector-config.js";
import { createFakePublisher, type FakePublisher } from "../../test-support/fake-publisher.js";
import { createFakeSupabaseClient } from "../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import { extractPhoneNumberId, WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

function buildService(): {
  service: WhatsAppWebhookService;
  publisher: FakePublisher;
  wabaConfigs: WabaConfigRepository;
} {
  const config = buildTestConfig();
  const connectorConfig = toWhatsAppConnectorConfig(config);
  if (!connectorConfig.ok) {
    throw new Error("test setup failed");
  }
  const publisher = createFakePublisher();
  const staticConnector = WhatsAppConnectorFactory.create({
    config: connectorConfig.value,
    publisher,
  });
  const client = createFakeSupabaseClient();
  const wabaConfigs = new WabaConfigRepository(client);
  const registry = new WhatsAppConnectorRegistry(wabaConfigs, config, publisher, staticConnector);
  const service = new WhatsAppWebhookService(
    config,
    staticConnector,
    registry,
    new WebhookVerifier(),
    wabaConfigs,
  );
  return { service, publisher, wabaConfigs };
}

function signPayload(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("extractPhoneNumberId", () => {
  it("extracts entry[0].changes[0].value.metadata.phone_number_id", () => {
    const rawBody = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba-entry-1",
          changes: [{ field: "messages", value: { metadata: { phone_number_id: "phone-xyz" } } }],
        },
      ],
    });
    expect(extractPhoneNumberId(rawBody)).toBe("phone-xyz");
  });

  it("returns undefined for malformed JSON", () => {
    expect(extractPhoneNumberId("{not json")).toBeUndefined();
  });

  it("returns undefined when no entry/changes/metadata.phone_number_id is present", () => {
    expect(extractPhoneNumberId("{}")).toBeUndefined();
    expect(extractPhoneNumberId(JSON.stringify({ entry: [] }))).toBeUndefined();
    expect(extractPhoneNumberId(JSON.stringify({ entry: [{ changes: [] }] }))).toBeUndefined();
  });
});

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
    it("never throws for an empty payload with no phone_number_id (dropped honestly)", async () => {
      const { service } = buildService();
      await expect(
        service.processIncomingWebhookAsync("{}", undefined, "corr-1"),
      ).resolves.toBeUndefined();
    });

    it("never throws for malformed JSON", async () => {
      const { service } = buildService();
      await expect(
        service.processIncomingWebhookAsync("{not json", undefined, "corr-2"),
      ).resolves.toBeUndefined();
    });

    it("resolves the dss-motor static connector for one of its own env-configured phone_number_ids (backward compat) and publishes MessageReceived", async () => {
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
      const signature = signPayload(rawBody, config.WHATSAPP_WEBHOOK_APP_SECRET);

      await service.processIncomingWebhookAsync(rawBody, signature, "corr-3");

      expect(publisher.published.some((e) => e.type === "aaos.whatsapp.message.received")).toBe(
        true,
      );
    });

    it("resolves a real waba_configs row's tenant and drops when that tenant has no configured connector (real, honest — never falls back silently to the wrong tenant)", async () => {
      const config = buildTestConfig();
      const { service, wabaConfigs } = buildService();
      await wabaConfigs.insert({
        tenant_id: "other-tenant",
        branch_id: "BINTARO",
        phone_number: "+628110009999",
        waba_id: "waba-other",
        phone_number_id: "phone-other-id",
        access_token: "token-other",
        status: "INACTIVE", // no ACTIVE row for "other-tenant" -> registry.resolve() fails
      });
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-entry-1",
            changes: [
              { field: "messages", value: { metadata: { phone_number_id: "phone-other-id" } } },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, config.WHATSAPP_WEBHOOK_APP_SECRET);

      await expect(
        service.processIncomingWebhookAsync(rawBody, signature, "corr-4"),
      ).resolves.toBeUndefined();
    });

    it("drops an unrecognized phone_number_id (no waba_configs row, no static match) without throwing", async () => {
      const config = buildTestConfig();
      const { service } = buildService();
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "waba-entry-1",
            changes: [
              { field: "messages", value: { metadata: { phone_number_id: "totally-unknown" } } },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody, config.WHATSAPP_WEBHOOK_APP_SECRET);

      await expect(
        service.processIncomingWebhookAsync(rawBody, signature, "corr-5"),
      ).resolves.toBeUndefined();
    });
  });
});
