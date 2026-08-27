import { createHmac } from "node:crypto";

import { WebhookVerifier } from "@aos/meta-ads-connector";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";
import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";
import { SystemWebhookConfigRepository } from "../../superadmin/infrastructure/system-webhook-config.repository.js";
import { WebhookSecretsService } from "../../webhook-config/webhook-secrets.service.js";

import { WebhookSignatureGuard } from "./webhook-signature.guard.js";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

function buildWebhookSecrets(config = buildTestConfig()): WebhookSecretsService {
  return new WebhookSecretsService(
    new SystemWebhookConfigRepository(createFakeSupabaseClient()),
    config,
  );
}

describe("WebhookSignatureGuard", () => {
  it("allows a request with a valid X-Hub-Signature-256", async () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from(JSON.stringify({ object: "page", entry: [] }), "utf8");
    const signature = sign(rawBody.toString("utf8"), config.META_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("throws UnauthorizedException for a missing signature header", async () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(buildFakeRequest({ rawBody }));
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException for a mismatched signature", async () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({
        headers: { "x-hub-signature-256": "sha256=deadbeef" },
        rawBody,
      }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("treats an array-valued signature header as absent and rejects", async () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": ["a", "b"] }, rawBody }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("treats a missing rawBody as an empty string", async () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), buildWebhookSecrets(config));
    const signature = sign("", config.META_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature } }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("uses WebhookSecretsService's resolved app secret (a DB override), not the raw .env value", async () => {
    const config = buildTestConfig();
    const client = createFakeSupabaseClient();
    client.seed("system_webhook_config", {
      id: "default",
      whatsapp_webhook_verify_token: null,
      whatsapp_webhook_app_secret: null,
      meta_webhook_verify_token: null,
      meta_webhook_app_secret: "db-override-secret",
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    const webhookSecrets = new WebhookSecretsService(
      new SystemWebhookConfigRepository(client),
      config,
    );
    const guard = new WebhookSignatureGuard(new WebhookVerifier(), webhookSecrets);
    const rawBody = Buffer.from("{}", "utf8");
    const signature = sign("{}", "db-override-secret");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    // The OLD .env secret must no longer verify — proves the override, not the fallback, was used.
    const staleSignature = sign("{}", config.META_WEBHOOK_APP_SECRET);
    const staleContext = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": staleSignature }, rawBody }),
    );
    await expect(guard.canActivate(staleContext)).rejects.toThrow(UnauthorizedException);
  });
});
