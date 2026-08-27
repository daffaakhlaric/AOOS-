import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { SystemWebhookConfigRepository } from "./system-webhook-config.repository.js";

describe("SystemWebhookConfigRepository", () => {
  it("get() returns undefined when no row exists yet (a real, valid, honest state)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemWebhookConfigRepository(client);
    expect(await repo.get()).toBeUndefined();
  });

  it("upsert() inserts a real row onto the fixed 'default' id when none exists yet", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemWebhookConfigRepository(client);
    const row = await repo.upsert({ meta_webhook_verify_token: "test-verify-token" });
    expect(row.id).toBe("default");
    expect(row.meta_webhook_verify_token).toBe("test-verify-token");
    expect(row.updated_at).not.toBeNull();
  });

  it("upsert() updates the SAME fixed-id row on a second call — never inserts a second row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemWebhookConfigRepository(client);
    await repo.upsert({ meta_webhook_verify_token: "first-token" });
    await repo.upsert({ meta_webhook_verify_token: "second-token" });
    expect(client.rows("system_webhook_config")).toHaveLength(1);
    const row = await repo.get();
    expect(row?.meta_webhook_verify_token).toBe("second-token");
  });

  it("upsert() stores exactly the patch it's given (null-clearing semantics live one layer up, in WebhookSecretsService's caller)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemWebhookConfigRepository(client);
    await repo.upsert({ meta_webhook_app_secret: "a-real-secret" });
    await repo.upsert({ meta_webhook_app_secret: null });
    const row = await repo.get();
    expect(row?.meta_webhook_app_secret).toBeNull();
  });
});
