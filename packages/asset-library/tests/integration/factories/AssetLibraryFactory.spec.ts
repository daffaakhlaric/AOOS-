import { describe, expect, it } from "vitest";

import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetLibraryFactory } from "../../../src/factories/AssetLibraryFactory.js";
import { createFakeLogger } from "../../helpers/logger.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseStorageClient } from "../../helpers/storage.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  bucketName: "mobix-assets",
  tenantId: "dss-motor",
  imageSizeLimitBytes: 10 * 1024 * 1024,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

describe("AssetLibraryFactory (integration)", () => {
  it("composes a fully wired AssetLibrary with injected fakes", async () => {
    const library = AssetLibraryFactory.create({
      config,
      publisher: createFakePublisher(),
      logger: createFakeLogger(),
      supabaseClient: createFakeSupabaseClient(),
      supabaseStorageClient: createFakeSupabaseStorageClient(),
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    const asset = unwrap(
      await library.uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "logo.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.fileName).toBe("logo.png");

    const found = unwrap(await library.getAsset.execute(asset.id.toString()));
    expect(found.id.equals(asset.id)).toBe(true);

    const queried = unwrap(await library.assetQueryService.byId(asset.id.toString()));
    expect(queried.id.equals(asset.id)).toBe(true);

    const brandAssets = unwrap(await library.getBrandAssets.execute());
    expect(brandAssets.count).toBe(1);
  });

  it("builds real Supabase clients when none are injected", () => {
    const originalWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket;
    (globalThis as { WebSocket?: unknown }).WebSocket = class FakeWebSocket {};
    try {
      const library = AssetLibraryFactory.create({ config, publisher: createFakePublisher() });
      expect(library.uploadAsset).toBeDefined();
      expect(library.assetService).toBeDefined();
    } finally {
      (globalThis as { WebSocket?: unknown }).WebSocket = originalWebSocket;
    }
  });

  it("uses a default logger and clock when none are provided", async () => {
    const library = AssetLibraryFactory.create({
      config,
      publisher: createFakePublisher(),
      supabaseClient: createFakeSupabaseClient(),
      supabaseStorageClient: createFakeSupabaseStorageClient(),
    });
    expect(library.assetService).toBeDefined();

    // Exercises the factory's default `now` clock (only used when the caller omits `now`).
    const asset = unwrap(
      await library.uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "default-clock.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.createdAt).toBeInstanceOf(Date);
  });
});
