import { describe, expect, it } from "vitest";

import { createFakeSupabaseClient } from "../../../test-support/fake-supabase-client.js";

import { SystemMetaOAuthConfigRepository } from "./system-meta-oauth-config.repository.js";

describe("SystemMetaOAuthConfigRepository", () => {
  it("get() returns undefined when no row exists yet (a real, valid, honest state)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemMetaOAuthConfigRepository(client);
    expect(await repo.get()).toBeUndefined();
  });

  it("upsert() inserts a real row onto the fixed 'default' id when none exists yet", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemMetaOAuthConfigRepository(client);
    const row = await repo.upsert({ meta_app_id: "test-meta-app-id" });
    expect(row.id).toBe("default");
    expect(row.meta_app_id).toBe("test-meta-app-id");
    expect(row.updated_at).not.toBeNull();
  });

  it("upsert() updates the SAME fixed-id row on a second call — never inserts a second row", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemMetaOAuthConfigRepository(client);
    await repo.upsert({ meta_app_id: "first-app-id" });
    await repo.upsert({ meta_app_id: "second-app-id" });
    expect(client.rows("system_meta_oauth_config")).toHaveLength(1);
    const row = await repo.get();
    expect(row?.meta_app_id).toBe("second-app-id");
  });

  it("upsert() stores exactly the encrypted-envelope patch it's given (this repository never encrypts/decrypts itself)", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemMetaOAuthConfigRepository(client);
    await repo.upsert({ meta_app_secret_encrypted: "aa:bb:cc" });
    const row = await repo.get();
    expect(row?.meta_app_secret_encrypted).toBe("aa:bb:cc");
  });

  it("upsert() supports null-clearing a previously-set column", async () => {
    const client = createFakeSupabaseClient();
    const repo = new SystemMetaOAuthConfigRepository(client);
    await repo.upsert({ wa_config_id: "a-real-config-id" });
    await repo.upsert({ wa_config_id: null });
    const row = await repo.get();
    expect(row?.wa_config_id).toBeNull();
  });
});
