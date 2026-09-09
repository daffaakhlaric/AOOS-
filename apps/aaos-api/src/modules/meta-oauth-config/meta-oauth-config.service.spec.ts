import { describe, expect, it, vi } from "vitest";

import { EncryptionService } from "../../common/encryption.service.js";
import { buildTestConfig } from "../../test-support/fixtures.js";
import type {
  SystemMetaOAuthConfigRepository,
  SystemMetaOAuthConfigRow,
} from "../superadmin/infrastructure/system-meta-oauth-config.repository.js";

import { MetaOAuthConfigService } from "./meta-oauth-config.service.js";

// A fixed, obviously-fake 64-hex-char (32-byte) test key — never a real secret.
const TEST_KEY = "0123456789abcdef".repeat(4);

function buildFakeRepository(
  row: SystemMetaOAuthConfigRow | undefined,
): SystemMetaOAuthConfigRepository {
  return {
    get: vi.fn(async () => row),
    upsert: vi.fn(),
  } as unknown as SystemMetaOAuthConfigRepository;
}

describe("MetaOAuthConfigService", () => {
  it("falls back to .env when no override row exists yet", async () => {
    const config = buildTestConfig({ META_APP_ID: "env-app-id", META_APP_SECRET: "env-secret" });
    const repository = buildFakeRepository(undefined);
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    expect(await service.getMetaAppConfig()).toEqual({
      appId: "env-app-id",
      appSecret: "env-secret",
      waConfigId: config.WA_CONFIG_ID,
    });
  });

  it("prefers a real, non-empty DB override over .env, decrypting the stored secret", async () => {
    const config = buildTestConfig({ META_APP_ID: "env-app-id", META_APP_SECRET: "env-secret" });
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const encryptedSecret = encryption.encrypt("db-real-secret");
    const repository = buildFakeRepository({
      id: "default",
      meta_app_id: "db-app-id",
      meta_app_secret_encrypted: encryptedSecret,
      wa_config_id: "db-wa-config-id",
      updated_at: "2026-09-09T00:00:00.000Z",
    });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    expect(await service.getMetaAppConfig()).toEqual({
      appId: "db-app-id",
      appSecret: "db-real-secret",
      waConfigId: "db-wa-config-id",
    });
  });

  it("treats a NULL or empty-string DB column as 'no override' — falls back to .env for that field only", async () => {
    const config = buildTestConfig({ META_APP_ID: "env-app-id", META_APP_SECRET: "env-secret" });
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const repository = buildFakeRepository({
      id: "default",
      meta_app_id: "db-app-id",
      meta_app_secret_encrypted: null,
      wa_config_id: "",
      updated_at: "2026-09-09T00:00:00.000Z",
    });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    expect(await service.getMetaAppConfig()).toEqual({
      appId: "db-app-id",
      appSecret: "env-secret",
      waConfigId: config.WA_CONFIG_ID,
    });
  });

  it("caches the resolved config — a second call does not re-query the repository", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository(undefined);
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    await service.getMetaAppConfig();
    await service.getMetaAppConfig();
    expect(repository.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to .env, without throwing, when the repository read itself fails", async () => {
    const config = buildTestConfig({ META_APP_ID: "env-app-id", META_APP_SECRET: "env-secret" });
    const repository = {
      get: vi.fn(async () => {
        throw new Error("network error");
      }),
      upsert: vi.fn(),
    } as unknown as SystemMetaOAuthConfigRepository;
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    await expect(service.getMetaAppConfig()).resolves.toEqual({
      appId: "env-app-id",
      appSecret: "env-secret",
      waConfigId: config.WA_CONFIG_ID,
    });
  });

  it("does NOT swallow a decrypt failure — a tampered/corrupted stored secret throws rather than silently falling back", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository({
      id: "default",
      meta_app_id: null,
      meta_app_secret_encrypted: "tampered:not:valid",
      wa_config_id: null,
      updated_at: "2026-09-09T00:00:00.000Z",
    });
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    await expect(service.getMetaAppConfig()).rejects.toThrow();
  });

  it("invalidate() clears the cache, forcing a fresh repository read", async () => {
    const config = buildTestConfig();
    const repository = buildFakeRepository(undefined);
    const encryption = new EncryptionService({ TOKEN_ENCRYPTION_KEY: TEST_KEY });
    const service = new MetaOAuthConfigService(repository, encryption, config);

    await service.getMetaAppConfig();
    service.invalidate();
    await service.getMetaAppConfig();
    expect(repository.get).toHaveBeenCalledTimes(2);
  });
});
