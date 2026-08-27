import { describe, expect, it, vi } from "vitest";

import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  SystemWebhookConfigRepository,
  SystemWebhookConfigRow,
} from "../superadmin/infrastructure/system-webhook-config.repository.js";

import { WebhookSecretsService } from "./webhook-secrets.service.js";

function buildFakeRepository(
  row: SystemWebhookConfigRow | undefined,
): SystemWebhookConfigRepository {
  return {
    get: vi.fn(async () => row),
    upsert: vi.fn(),
  } as unknown as SystemWebhookConfigRepository;
}

describe("WebhookSecretsService", () => {
  it("falls back to .env when no override row exists yet", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository(undefined);
    const service = new WebhookSecretsService(repository, config);

    expect(await service.getMetaSecrets()).toEqual({
      verifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
      appSecret: config.META_WEBHOOK_APP_SECRET,
    });
    expect(await service.getWhatsappSecrets()).toEqual({
      verifyToken: config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: config.WHATSAPP_WEBHOOK_APP_SECRET,
    });
  });

  it("prefers a real, non-empty DB override over .env", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository({
      id: "default",
      whatsapp_webhook_verify_token: "db-whatsapp-verify",
      whatsapp_webhook_app_secret: "db-whatsapp-secret",
      meta_webhook_verify_token: "db-meta-verify",
      meta_webhook_app_secret: "db-meta-secret",
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    const service = new WebhookSecretsService(repository, config);

    expect(await service.getMetaSecrets()).toEqual({
      verifyToken: "db-meta-verify",
      appSecret: "db-meta-secret",
    });
    expect(await service.getWhatsappSecrets()).toEqual({
      verifyToken: "db-whatsapp-verify",
      appSecret: "db-whatsapp-secret",
    });
  });

  it("treats a NULL or empty-string DB column as 'no override' — falls back to .env for that field only", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository({
      id: "default",
      whatsapp_webhook_verify_token: null,
      whatsapp_webhook_app_secret: "",
      meta_webhook_verify_token: "db-meta-verify",
      meta_webhook_app_secret: null,
      updated_at: "2026-08-27T00:00:00.000Z",
    });
    const service = new WebhookSecretsService(repository, config);

    expect(await service.getWhatsappSecrets()).toEqual({
      verifyToken: config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: config.WHATSAPP_WEBHOOK_APP_SECRET,
    });
    expect(await service.getMetaSecrets()).toEqual({
      verifyToken: "db-meta-verify",
      appSecret: config.META_WEBHOOK_APP_SECRET,
    });
  });

  it("caches the resolved pair — a second call does not re-query the repository", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository(undefined);
    const service = new WebhookSecretsService(repository, config);

    await service.getMetaSecrets();
    await service.getMetaSecrets();
    expect(repository.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to .env, without throwing, when the repository read itself fails (a webhook signature check must never 500 on a config-table hiccup)", async () => {
    const config = buildTestConfig();
    const repository = {
      get: vi.fn(async () => {
        throw new Error("network error");
      }),
      upsert: vi.fn(),
    } as unknown as SystemWebhookConfigRepository;
    const service = new WebhookSecretsService(repository, config);

    await expect(service.getMetaSecrets()).resolves.toEqual({
      verifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
      appSecret: config.META_WEBHOOK_APP_SECRET,
    });
  });

  it("invalidate() clears BOTH cached pairs, forcing a fresh repository read for either", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository(undefined);
    const service = new WebhookSecretsService(repository, config);

    await service.getMetaSecrets();
    await service.getWhatsappSecrets();
    service.invalidate();
    await service.getMetaSecrets();
    await service.getWhatsappSecrets();
    expect(repository.get).toHaveBeenCalledTimes(4);
  });
});
