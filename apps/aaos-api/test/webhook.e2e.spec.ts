import { createHmac } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { mswServer, registerHappyPathMetaApiHandlers } from "../src/test-support/meta-api-msw.js";

import { bootstrapTestApp } from "./helpers/bootstrap.js";

const API_KEY = "test-api-key";
const WEBHOOK_APP_SECRET = "test-app-secret";
const WEBHOOK_VERIFY_TOKEN = "test-verify-token";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", WEBHOOK_APP_SECRET).update(body, "utf8").digest("hex")}`;
}

describe("webhook e2e — GET/POST /webhooks/meta", () => {
  let app: NestFastifyApplication;

  // "bypass" (not "error"): local supertest traffic has no registered MSW handler and must pass
  // through untouched — only the Meta Graph API calls the app itself issues are mocked.
  beforeAll(async () => {
    mswServer.listen({ onUnhandledRequest: "bypass" });
    app = await bootstrapTestApp();
  });
  afterEach(() => mswServer.resetHandlers());
  afterAll(async () => {
    mswServer.close();
    await app.close();
  });

  // AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) — `WebhookSignatureGuard`/`WebhookService` now resolve
  // secrets through `WebhookSecretsService`, which reads `system_webhook_config` on its first
  // call. In THIS sandboxed test environment the fake `SUPABASE_URL` fixture has no real DNS
  // record, and Node's `fetch` takes several real seconds (verified directly: ~7s) to report the
  // resolution failure — a one-time cost paid once per bootstrapped test app (the service then
  // caches the `.env` fallback, per its own doc), never a production concern (a real deployed
  // Supabase project resolves in well under a second). The 3 tests below are bumped past the
  // default 5000ms so they measure real behavior rather than sandbox DNS latency.
  describe("GET /webhooks/meta (hub verify handshake)", () => {
    it("responds 200 with the plain-text challenge for a valid handshake, no auth required", async () => {
      const response = await request(app.getHttpServer()).get("/webhooks/meta").query({
        "hub.mode": "subscribe",
        "hub.verify_token": WEBHOOK_VERIFY_TOKEN,
        "hub.challenge": "e2e-challenge-123",
      });

      expect(response.status).toBe(200);
      expect(response.text).toBe("e2e-challenge-123");
      expect(response.headers["content-type"]).toContain("text/plain");
    }, 15000);

    it("responds 403 for a mismatched verify token", async () => {
      const response = await request(app.getHttpServer()).get("/webhooks/meta").query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "e2e-challenge-123",
      });

      expect(response.status).toBe(403);
    }, 15000);
  });

  describe("POST /webhooks/meta (inbound lead delivery)", () => {
    it("valid signature -> 200 { received: true } and LeadReceived is observably processed", async () => {
      registerHappyPathMetaApiHandlers();
      // Sync campaign data first so the CTWA lead's ad_id resolves via the connector's registry.
      const syncResponse = await request(app.getHttpServer())
        .get("/api/v1/campaigns")
        .set("x-api-key", API_KEY);
      expect(syncResponse.status).toBe(200);
      const adMetaId = syncResponse.body.campaigns[0].adSets[0].ads[0].metaId as string;

      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "entry-1",
            time: 1735689600,
            changes: [
              {
                field: "ctwa_message",
                value: {
                  ad_id: adMetaId,
                  waba_id: "waba-123",
                  phone_number: "+6281234567890",
                },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);

      const response = await request(app.getHttpServer())
        .post("/webhooks/meta")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", sign(rawBody))
        .send(rawBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
    }, 15000);

    it("invalid signature -> 401", async () => {
      const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const response = await request(app.getHttpServer())
        .post("/webhooks/meta")
        .set("Content-Type", "application/json")
        .set(
          "x-hub-signature-256",
          "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        )
        .send(rawBody);

      expect(response.status).toBe(401);
    });

    it("missing signature header -> 401", async () => {
      const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
      const response = await request(app.getHttpServer())
        .post("/webhooks/meta")
        .set("Content-Type", "application/json")
        .send(rawBody);

      expect(response.status).toBe(401);
    });

    it("valid signature but an unresolvable ad_id -> 422 (validation-shaped webhook error)", async () => {
      const payload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "entry-1",
            changes: [
              {
                field: "ctwa_message",
                value: { ad_id: "never-synced-ad-id", waba_id: "waba-1", phone_number: "+62800" },
              },
            ],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);

      const response = await request(app.getHttpServer())
        .post("/webhooks/meta")
        .set("Content-Type", "application/json")
        .set("x-hub-signature-256", sign(rawBody))
        .send(rawBody);

      expect(response.status).toBe(422);
    });
  });
});
