import { describe, expect, it } from "vitest";

import { parseAssetLibraryConfig } from "../../../src/config/AssetLibraryConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const FAKE_GCS_CREDENTIALS_JSON = JSON.stringify({
  type: "service_account",
  project_id: "fake-test-project",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
  client_email: "fake@fake-test-project.iam.gserviceaccount.com",
});

describe("parseAssetLibraryConfig", () => {
  it("accepts a valid config (gcsKeyFilePath) and applies defaults", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "service-key",
        gcsProjectId: "fake-test-project",
        gcsKeyFilePath: "./fake-service-account.json",
      }),
    );
    expect(config.gcsBucketName).toBe("aoos");
    expect(config.tenantId).toBe("dss-motor");
    expect(config.imageSizeLimitBytes).toBe(10 * 1024 * 1024);
    expect(config.videoSizeLimitBytes).toBe(100 * 1024 * 1024);
  });

  it("accepts a valid config (gcsCredentials JSON string)", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "service-key",
        gcsProjectId: "fake-test-project",
        gcsCredentials: FAKE_GCS_CREDENTIALS_JSON,
      }),
    );
    expect(config.gcsCredentials).toBe(FAKE_GCS_CREDENTIALS_JSON);
  });

  it("accepts explicit overrides", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "service-key",
        gcsBucketName: "custom-bucket",
        gcsProjectId: "fake-test-project",
        gcsKeyFilePath: "./fake-service-account.json",
        tenantId: "acme",
        imageSizeLimitBytes: 5_000_000,
        videoSizeLimitBytes: 50_000_000,
      }),
    );
    expect(config.gcsBucketName).toBe("custom-bucket");
    expect(config.tenantId).toBe("acme");
    expect(config.imageSizeLimitBytes).toBe(5_000_000);
    expect(config.videoSizeLimitBytes).toBe(50_000_000);
  });

  it("rejects an invalid supabaseUrl", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({
        supabaseUrl: "not-a-url",
        supabaseServiceKey: "key",
        gcsProjectId: "fake-test-project",
        gcsKeyFilePath: "./fake-service-account.json",
      }),
    );
    expect(error.message).toContain("AssetLibraryConfig validation failed");
  });

  it("rejects a missing supabaseServiceKey", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        gcsProjectId: "fake-test-project",
        gcsKeyFilePath: "./fake-service-account.json",
      }),
    );
    expect(error.message).toContain("supabaseServiceKey");
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseAssetLibraryConfig("not-an-object"));
    expect(error.message).toContain("AssetLibraryConfig validation failed");
  });

  it("rejects a missing gcsProjectId", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "key",
        gcsKeyFilePath: "./fake-service-account.json",
      }),
    );
    expect(error.message).toContain("gcsProjectId");
  });

  it("rejects a config with neither gcsCredentials nor gcsKeyFilePath (design resolution #2)", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "key",
        gcsProjectId: "fake-test-project",
      }),
    );
    expect(error.message).toContain("Either gcsCredentials or gcsKeyFilePath must be provided");
  });

  it("accepts a config with both gcsCredentials and gcsKeyFilePath provided (either satisfies the refine)", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "key",
        gcsProjectId: "fake-test-project",
        gcsCredentials: FAKE_GCS_CREDENTIALS_JSON,
        gcsKeyFilePath: "./fake-service-account.json",
      }),
    );
    expect(config.gcsCredentials).toBe(FAKE_GCS_CREDENTIALS_JSON);
    expect(config.gcsKeyFilePath).toBe("./fake-service-account.json");
  });
});
