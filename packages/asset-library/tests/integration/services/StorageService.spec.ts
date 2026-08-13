import { describe, expect, it } from "vitest";

import { StorageService } from "../../../src/application/services/StorageService.js";
import { StoragePath } from "../../../src/domain/value-objects/StoragePath.js";
import { createFakeAssetStorage } from "../../helpers/assetStorage.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  gcsBucketName: "aoos",
  gcsProjectId: "fake-test-project",
  gcsKeyFilePath: "./fake-service-account.json",
  tenantId: "dss-motor",
  imageSizeLimitBytes: IMAGE_MAX,
  videoSizeLimitBytes: VIDEO_MAX,
};

function makeService() {
  const fake = createFakeAssetStorage();
  return { fake, service: new StorageService(fake, config) };
}

describe("StorageService", () => {
  it("store() rejects an invalid MIME type with InvalidFileTypeError", async () => {
    const { service } = makeService();
    const error = unwrapErr(
      await service.store(StoragePath.brandAsset("f.gif"), Buffer.alloc(10), "image/gif"),
    );
    expect(error.name).toBe("InvalidFileTypeError");
  });

  it("store() rejects application/pdf with InvalidFileTypeError", async () => {
    const { service } = makeService();
    const error = unwrapErr(
      await service.store(StoragePath.brandAsset("f.pdf"), Buffer.alloc(10), "application/pdf"),
    );
    expect(error.name).toBe("InvalidFileTypeError");
  });

  it("store() accepts a jpeg image exactly at the 10MB limit", async () => {
    const { service } = makeService();
    const result = unwrap(
      await service.store(StoragePath.brandAsset("f.jpg"), Buffer.alloc(IMAGE_MAX), "image/jpeg"),
    );
    expect(result.fileSize.bytes).toBe(IMAGE_MAX);
  });

  it("store() rejects a jpeg image 1 byte over the 10MB limit with FileSizeLimitError", async () => {
    const { service } = makeService();
    const error = unwrapErr(
      await service.store(
        StoragePath.brandAsset("f.jpg"),
        Buffer.alloc(IMAGE_MAX + 1),
        "image/jpeg",
      ),
    );
    expect(error.name).toBe("FileSizeLimitError");
    expect(error.message).toContain("image limit");
  });

  it("store() accepts an mp4 video exactly at the 100MB limit", async () => {
    const { service } = makeService();
    const result = unwrap(
      await service.store(StoragePath.brandAsset("f.mp4"), Buffer.alloc(VIDEO_MAX), "video/mp4"),
    );
    expect(result.fileSize.bytes).toBe(VIDEO_MAX);
  }, 20000);

  it("store() rejects an mp4 video 1 byte over the 100MB limit with FileSizeLimitError", async () => {
    const { service } = makeService();
    const error = unwrapErr(
      await service.store(
        StoragePath.brandAsset("f.mp4"),
        Buffer.alloc(VIDEO_MAX + 1),
        "video/mp4",
      ),
    );
    expect(error.name).toBe("FileSizeLimitError");
    expect(error.message).toContain("video limit");
  }, 20000);

  it("store() surfaces a Storage upload error", async () => {
    const { service, fake } = makeService();
    fake.forceErrorOnce("disk full");
    const error = unwrapErr(
      await service.store(StoragePath.brandAsset("f.jpg"), Buffer.alloc(10), "image/jpeg"),
    );
    expect(error.name).toBe("StorageError");
  });

  it("store() returns the MimeType and PublicUrl on success", async () => {
    const { service } = makeService();
    const result = unwrap(
      await service.store(StoragePath.brandAsset("f.jpg"), Buffer.alloc(10), "image/jpeg"),
    );
    expect(result.mimeType.toString()).toBe("image/jpeg");
    expect(result.publicUrl.toString()).toContain("f.jpg");
  });
});
