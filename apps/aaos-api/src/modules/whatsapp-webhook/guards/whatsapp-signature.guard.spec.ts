import { createHmac } from "node:crypto";

import { WebhookVerifier } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";
import { SystemWebhookConfigRepository } from "../../superadmin/infrastructure/system-webhook-config.repository.js";
import { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

import { WhatsAppSignatureGuard } from "./whatsapp-signature.guard.js";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

function buildWebhookSecrets(config = buildTestConfig()): WebhookSecretsService {
  return new WebhookSecretsService(
    new SystemWebhookConfigRepository(createFakeSupabaseClient()),
    config,
  );
}

describe("WhatsAppSignatureGuard", () => {
  it("allows a request with a valid X-Hub-Signature-256", async () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from(
      JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
      "utf8",
    );
    const signature = sign(rawBody.toString("utf8"), config.WHATSAPP_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("still allows the request through even with a MISSING signature header — per the always-200 rule this guard never blocks", async () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(buildFakeRequest({ rawBody }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("still allows the request through even with a MISMATCHED signature — per the always-200 rule this guard never blocks", async () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({
        headers: { "x-hub-signature-256": "sha256=deadbeef" },
        rawBody,
      }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("treats an array-valued signature header as absent and still allows the request through", async () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": ["a", "b"] }, rawBody }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("treats a missing rawBody as an empty string", async () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const signature = sign("", config.WHATSAPP_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature } }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("resolves the app secret via WebhookSecretsService (a DB override) — always returns true regardless, per the always-200 rule", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed("system_webhook_config", {
      id: "default",
      whatsapp_webhook_verify_token: null,
      whatsapp_webhook_app_secret: "db-override-secret",
      meta_webhook_verify_token: null,
      meta_webhook_app_secret: null,
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    const webhookSecrets = new WebhookSecretsService(
      new SystemWebhookConfigRepository(client),
      config,
    );
    const guard = new WhatsAppSignatureGuard(new WebhookVerifier(), webhookSecrets);
    const rawBody = Buffer.from("{}", "utf8");
    const signature = sign("{}", "db-override-secret");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(webhookSecrets).toBeDefined();
  });
});
