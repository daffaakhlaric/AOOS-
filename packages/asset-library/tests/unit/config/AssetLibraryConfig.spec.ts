import { describe, expect, it } from "vitest";

import { parseAssetLibraryConfig } from "../../../src/config/AssetLibraryConfig.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("parseAssetLibraryConfig", () => {
  it("accepts a valid config and applies defaults", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "service-key",
      }),
    );
    expect(config.bucketName).toBe("mobix-assets");
    expect(config.tenantId).toBe("dss-motor");
    expect(config.imageSizeLimitBytes).toBe(10 * 1024 * 1024);
    expect(config.videoSizeLimitBytes).toBe(100 * 1024 * 1024);
  });

  it("accepts explicit overrides", () => {
    const config = unwrap(
      parseAssetLibraryConfig({
        supabaseUrl: "https://example.supabase.co",
        supabaseServiceKey: "service-key",
        bucketName: "custom-bucket",
        tenantId: "acme",
        imageSizeLimitBytes: 5_000_000,
        videoSizeLimitBytes: 50_000_000,
      }),
    );
    expect(config.bucketName).toBe("custom-bucket");
    expect(config.tenantId).toBe("acme");
    expect(config.imageSizeLimitBytes).toBe(5_000_000);
    expect(config.videoSizeLimitBytes).toBe(50_000_000);
  });

  it("rejects an invalid supabaseUrl", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({ supabaseUrl: "not-a-url", supabaseServiceKey: "key" }),
    );
    expect(error.message).toContain("AssetLibraryConfig validation failed");
  });

  it("rejects a missing supabaseServiceKey", () => {
    const error = unwrapErr(
      parseAssetLibraryConfig({ supabaseUrl: "https://example.supabase.co" }),
    );
    expect(error.message).toContain("supabaseServiceKey");
  });

  it("rejects a non-object input", () => {
    const error = unwrapErr(parseAssetLibraryConfig("not-an-object"));
    expect(error.message).toContain("AssetLibraryConfig validation failed");
  });
});
