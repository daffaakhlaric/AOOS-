import { createHmac } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bootstrapTestApp } from "./helpers/bootstrap.js";

const WEBHOOK_APP_SECRET = "test-whatsapp-app-secret";
const WEBHOOK_VERIFY_TOKEN = "test-whatsapp-verify-token";
const BINTARO_PHONE_NUMBER_ID = "100000000000001";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", WEBHOOK_APP_SECRET).update(body, "utf8").digest("hex")}`;
}

describe("whatsapp-webhook e2e — GET/POST /webhooks/whatsapp", () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  // AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) — `WhatsAppSignatureGuard`/`WhatsAppWebhookService` now
  // resolve secrets through `WebhookSecretsService`, which reads `system_webhook_config` on its
  // first call. In THIS sandboxed test environment the fake `SUPABASE_URL` fixture has no real
  // DNS record, and Node's `fetch` takes several real seconds (verified directly: ~7s) to report
  // the resolution failure — a one-time cost paid once per bootstrapped test app (the service
  // then caches the `.env` fallback, per its own doc), never a production concern. The 2 tests
  // below are bumped past the default 5000ms so they measure real behavior, not sandbox DNS
  // latency.
  describe("GET /webhooks/whatsapp (hub verify handshake)", () => {
    it("responds 200 with the plain-text challenge for a valid handshake, no auth required", async () => {
      const response = await request(app.getHttpServer()).get("/webhooks/whatsapp").query({
        "hub.mode": "subscribe",
        "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
        "hub.challenge": "e2e-wa-challenge-123",
      });

      expect(response.status).toBe(200);
      expect(response.text).toBe("e2e-wa-challenge-123");
      expect(response.headers["content-type"]).toContain("text/plain");
    }, 15000);

    it("responds 403 for a mismatched verify token", async () => {
      const response = await request(app.getHttpServer()).get("/webhooks/whatsapp").query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "e2e-wa-challenge-123",
      });

      expect(response.status).toBe(403);
    }, 15000);
  });

  describe("POST /webhooks/whatsapp (inbound message delivery)", () => {
    it("valid signature -> 200 { received: true }", async () => {
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
                    display_phone_number: "+628110000001",
                    phone_number_id: BINTARO_PHONE_NUMBER_ID,
                  },
                  messages: [
                    {
                      from: "628123456789",
                      id: "wamid.e2e1",
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

      const response = await request(app.getHttpServer())
        .post("/webhooks/whatsapp")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", sign(rawBody))
        .send(rawBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });

    it("invalid signature -> still 200 { received: true } (always-200 rule), not processed", async () => {
      const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const response = await request(app.getHttpServer())
        .post("/webhooks/whatsapp")
        .set("Content-Type", "application/json")
        .set(
          "x-hub-signature-256",
          "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        )
        .send(rawBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });

    it("missing signature header -> still 200 { received: true } (always-200 rule)", async () => {
      const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const response = await request(app.getHttpServer())
        .post("/webhooks/whatsapp")
        .set("Content-Type", "application/json")
        .send(rawBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    });
  });
});
