import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DefaultAssetTagger } from "../../../src/application/services/DefaultAssetTagger.js";
import { StorageService } from "../../../src/application/services/StorageService.js";
import { UploadAsset } from "../../../src/application/use-cases/UploadAsset.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { SupabaseStorageClient } from "../../../src/infrastructure/supabase/SupabaseStorageClient.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
import { createFakeSupabaseStorageClient } from "../../helpers/storage.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const IMAGE_MAX = 10 * 1024 * 1024;

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  bucketName: "mobix-assets",
  tenantId: "dss-motor",
  imageSizeLimitBytes: IMAGE_MAX,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

function makeUploadAsset(now = () => new Date("2026-01-01T00:00:00.000Z")) {
  const client = createFakeSupabaseClient();
  const storageClient = createFakeSupabaseStorageClient();
  const repository = new AssetRepository(client);
  const storage = new SupabaseStorageClient(storageClient, config.bucketName);
  const storageService = new StorageService(storage, config);
  const publisher = createFakePublisher();
  const events = new AssetLibraryEvents(publisher);
  const uploadAsset = new UploadAsset(
    repository,
    storageService,
    new DefaultAssetTagger(),
    events,
    now,
  );
  return { uploadAsset, repository, publisher, storageClient };
}

describe("UploadAsset (integration)", () => {
  it("jpeg upload -> Asset with a publicUrl", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(1024),
        fileName: "photo-1.jpg",
        mimeType: "image/jpeg",
        type: AssetType.UNIT_PHOTO,
        unitId: "unit-1",
        branch: Branch.BINTARO,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.publicUrl.toString().length).toBeGreaterThan(0);
    expect(asset.status).toBe(AssetStatus.ACTIVE);
    expect(asset.storagePath.toString()).toMatch(/^units\/unit-1\/photo-\d+\.jpg$/);
  });

  it("mp4 upload -> Asset type AI_VIDEO", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(1024),
        fileName: "creative.mp4",
        mimeType: "video/mp4",
        type: AssetType.AI_VIDEO,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.type).toBe(AssetType.AI_VIDEO);
  });

  it("pdf upload -> InvalidFileTypeError", async () => {
    const { uploadAsset } = makeUploadAsset();
    const error = unwrapErr(
      await uploadAsset.execute({
        file: Buffer.alloc(1024),
        fileName: "brochure.pdf",
        mimeType: "application/pdf",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.name).toBe("InvalidFileTypeError");
  });

  it("file > 10MB -> FileSizeLimitError", async () => {
    const { uploadAsset } = makeUploadAsset();
    const error = unwrapErr(
      await uploadAsset.execute({
        file: Buffer.alloc(IMAGE_MAX + 1),
        fileName: "huge.jpg",
        mimeType: "image/jpeg",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.name).toBe("FileSizeLimitError");
  });

  it("emits an AssetUploaded event", async () => {
    const { uploadAsset, publisher } = makeUploadAsset();
    await uploadAsset.execute({
      file: Buffer.alloc(10),
      fileName: "logo.png",
      mimeType: "image/png",
      type: AssetType.BRAND,
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.assets.uploaded");
  });

  it("rejects invalid input via Zod validation", async () => {
    const { uploadAsset } = makeUploadAsset();
    const error = unwrapErr(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("UploadAsset input validation failed");
  });

  it("requires unitId when type is UNIT_PHOTO", async () => {
    const { uploadAsset } = makeUploadAsset();
    const error = unwrapErr(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        type: AssetType.UNIT_PHOTO,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("unitId is required");
  });

  it("rejects an implausible unitYear (Asset.create's own validation)", async () => {
    const { uploadAsset } = makeUploadAsset();
    const error = unwrapErr(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        type: AssetType.UNIT_PHOTO,
        unitId: "unit-1",
        unitYear: 1800,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("unitYear");
  });

  it("routes TESTIMONIAL uploads under testimonials/", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "testimonial-1.jpg",
        mimeType: "image/jpeg",
        type: AssetType.TESTIMONIAL,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.storagePath.toString()).toBe("testimonials/testimonial-1.jpg");
  });

  it("routes OVERLAY uploads under brand/", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "overlay-dp-ringan.png",
        mimeType: "image/png",
        type: AssetType.OVERLAY,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.storagePath.toString()).toBe("brand/overlay-dp-ringan.png");
  });

  it("routes AI_IMAGE uploads under ai-creatives/manual/", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "creative.jpg",
        mimeType: "image/jpeg",
        type: AssetType.AI_IMAGE,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.storagePath.toString()).toBe("ai-creatives/manual/image-1.jpg");
  });

  it("includes manual tags alongside derived tags", async () => {
    const { uploadAsset } = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        type: AssetType.UNIT_PHOTO,
        unitId: "unit-1",
        unitModel: "Xpander Cross",
        unitYear: 2019,
        branch: Branch.BINTARO,
        tags: ["angle:front"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    const tagStrings = asset.tags.map((tag) => tag.toString());
    expect(tagStrings).toContain("angle:front");
    expect(tagStrings).toContain("model:Xpander Cross");
    expect(tagStrings).toContain("year:2019");
    expect(tagStrings).toContain("branch:BINTARO");
  });

  it("surfaces a repository insert error", async () => {
    const client = createFakeSupabaseClient();
    client.forceErrorOnce("assets", "insert failed");
    const failingRepository = new AssetRepository(client);
    const storageClient = createFakeSupabaseStorageClient();
    const storage = new SupabaseStorageClient(storageClient, config.bucketName);
    const storageService = new StorageService(storage, config);
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingUploadAsset = new UploadAsset(
      failingRepository,
      storageService,
      new DefaultAssetTagger(),
      events,
    );
    const error = unwrapErr(
      await failingUploadAsset.execute({
        file: Buffer.alloc(10),
        fileName: "logo.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("AssetRepository.insert failed");
  });
});
