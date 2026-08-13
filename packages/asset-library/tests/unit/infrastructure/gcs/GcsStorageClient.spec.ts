import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorageError } from "../../../../src/domain/errors/StorageError.js";
import { GcsStorageClient } from "../../../../src/infrastructure/gcs/GcsStorageClient.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

/**
 * Fully mocks the real `@google-cloud/storage` SDK — zero real GCS network calls, zero real
 * credential files touched, per this task's security instruction. `storageCtorSpy` captures every
 * `new Storage(options)` call's `options` so tests can assert the auth-resolution logic
 * (`gcsCredentials` JSON string vs. `gcsKeyFilePath` vs. neither) without ever constructing a real
 * `Storage` client.
 */
const { storageCtorSpy, bucketSpy, fileSpy, saveSpy, downloadSpy, deleteSpy } = vi.hoisted(() => ({
  storageCtorSpy: vi.fn(),
  bucketSpy: vi.fn(),
  fileSpy: vi.fn(),
  saveSpy: vi.fn().mockResolvedValue(undefined),
  downloadSpy: vi.fn().mockResolvedValue([Buffer.from("fake-downloaded-bytes")]),
  deleteSpy: vi.fn().mockResolvedValue([{}]),
}));

vi.mock("@google-cloud/storage", () => {
  class FakeStorage {
    constructor(options: unknown) {
      storageCtorSpy(options);
    }

    bucket(name: string) {
      bucketSpy(name);
      return {
        file: (path: string) => {
          fileSpy(path);
          return { save: saveSpy, download: downloadSpy, delete: deleteSpy };
        },
      };
    }
  }
  return { Storage: FakeStorage };
});

const FAKE_CREDENTIALS_JSON = JSON.stringify({
  type: "service_account",
  project_id: "fake-test-project",
  private_key: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
  client_email: "fake@fake-test-project.iam.gserviceaccount.com",
});

const baseConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  gcsBucketName: "aoos",
  gcsProjectId: "fake-test-project",
  tenantId: "dss-motor",
  imageSizeLimitBytes: 10 * 1024 * 1024,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

beforeEach(() => {
  vi.clearAllMocks();
  saveSpy.mockResolvedValue(undefined);
  downloadSpy.mockResolvedValue([Buffer.from("fake-downloaded-bytes")]);
  deleteSpy.mockResolvedValue([{}]);
});

describe("GcsStorageClient — construction / auth resolution", () => {
  it("builds a Storage client from gcsCredentials (JSON string)", () => {
    new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
    expect(storageCtorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "fake-test-project",
        credentials: expect.objectContaining({
          client_email: "fake@fake-test-project.iam.gserviceaccount.com",
        }) as unknown,
      }),
    );
  });

  it("builds a Storage client from gcsKeyFilePath", () => {
    new GcsStorageClient({ ...baseConfig, gcsKeyFilePath: "./fake-service-account.json" });
    expect(storageCtorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "fake-test-project",
        keyFilename: "./fake-service-account.json",
      }),
    );
  });

  it("prefers gcsCredentials over gcsKeyFilePath when both are provided (design resolution #3)", () => {
    new GcsStorageClient({
      ...baseConfig,
      gcsCredentials: FAKE_CREDENTIALS_JSON,
      gcsKeyFilePath: "./fake-service-account.json",
    });
    const call = storageCtorSpy.mock.calls[0]?.[0] as {
      credentials?: unknown;
      keyFilename?: unknown;
    };
    expect(call.credentials).toBeDefined();
    expect(call.keyFilename).toBeUndefined();
  });

  it("throws a StorageError on init when neither gcsCredentials nor gcsKeyFilePath is provided", () => {
    expect(() => new GcsStorageClient({ ...baseConfig })).toThrow(StorageError);
  });

  it("throws with a message naming both missing config fields", () => {
    expect(() => new GcsStorageClient({ ...baseConfig })).toThrow(/gcsCredentials.*gcsKeyFilePath/);
  });

  it("does not construct a real Storage client when construction fails validation", () => {
    expect(() => new GcsStorageClient({ ...baseConfig })).toThrow();
    expect(storageCtorSpy).not.toHaveBeenCalled();
  });
});

describe("GcsStorageClient — upload()", () => {
  function makeClient() {
    return new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
  }

  it("calls storage.bucket(bucketName)", async () => {
    const client = makeClient();
    await client.upload({
      path: "brand/logo.png",
      fileBody: Buffer.from("fake-bytes"),
      contentType: "image/png",
    });
    expect(bucketSpy).toHaveBeenCalledWith("aoos");
  });

  it("calls bucket.file(path)", async () => {
    const client = makeClient();
    await client.upload({
      path: "brand/logo.png",
      fileBody: Buffer.from("fake-bytes"),
      contentType: "image/png",
    });
    expect(fileSpy).toHaveBeenCalledWith("brand/logo.png");
  });

  it("calls file.save() with the buffer and contentType", async () => {
    const client = makeClient();
    const buffer = Buffer.from("fake-bytes");
    await client.upload({ path: "brand/logo.png", fileBody: buffer, contentType: "image/png" });
    expect(saveSpy).toHaveBeenCalledWith(
      buffer,
      expect.objectContaining({ contentType: "image/png", resumable: false }),
    );
  });

  it("resolves the input path in the returned UploadedFile", async () => {
    const client = makeClient();
    const result = unwrap(
      await client.upload({
        path: "units/unit-1/photo-1.jpg",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/jpeg",
      }),
    );
    expect(result.path).toBe("units/unit-1/photo-1.jpg");
  });

  it("resolves a GCS-shaped publicUrl", async () => {
    const client = makeClient();
    const result = unwrap(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(result.publicUrl).toBe("https://storage.googleapis.com/aoos/brand/logo.png");
  });

  it("surfaces a StorageError when save() rejects with an Error", async () => {
    saveSpy.mockRejectedValueOnce(new Error("bucket not found"));
    const client = makeClient();
    const error = unwrapErr(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toContain("GcsStorageClient.upload failed");
    expect(error.message).toContain("bucket not found");
  });

  it("surfaces a StorageError when save() rejects with a non-Error value", async () => {
    saveSpy.mockRejectedValueOnce("some plain string rejection");
    const client = makeClient();
    const error = unwrapErr(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(error.message).toContain("some plain string rejection");
  });

  it("handles two uploads to different paths independently", async () => {
    const client = makeClient();
    const first = unwrap(
      await client.upload({
        path: "brand/a.png",
        fileBody: Buffer.from("a"),
        contentType: "image/png",
      }),
    );
    const second = unwrap(
      await client.upload({
        path: "brand/b.png",
        fileBody: Buffer.from("b"),
        contentType: "image/png",
      }),
    );
    expect(first.path).toBe("brand/a.png");
    expect(second.path).toBe("brand/b.png");
    expect(fileSpy).toHaveBeenCalledTimes(2);
  });

  it("uses the configured gcsBucketName in the resolved publicUrl", async () => {
    const client = new GcsStorageClient({
      ...baseConfig,
      gcsBucketName: "custom-bucket",
      gcsCredentials: FAKE_CREDENTIALS_JSON,
    });
    const result = unwrap(
      await client.upload({
        path: "brand/logo.png",
        fileBody: Buffer.from("fake-bytes"),
        contentType: "image/png",
      }),
    );
    expect(result.publicUrl).toBe("https://storage.googleapis.com/custom-bucket/brand/logo.png");
  });
});

describe("GcsStorageClient — download()", () => {
  function makeClient() {
    return new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
  }

  it("calls bucket(bucketName).file(path).download()", async () => {
    const client = makeClient();
    await client.download("brand/logo.png");
    expect(bucketSpy).toHaveBeenCalledWith("aoos");
    expect(fileSpy).toHaveBeenCalledWith("brand/logo.png");
    expect(downloadSpy).toHaveBeenCalled();
  });

  it("resolves the downloaded Buffer", async () => {
    const client = makeClient();
    const buffer = unwrap(await client.download("brand/logo.png"));
    expect(buffer.toString()).toBe("fake-downloaded-bytes");
  });

  it("surfaces a StorageError when download() rejects", async () => {
    downloadSpy.mockRejectedValueOnce(new Error("object not found"));
    const client = makeClient();
    const error = unwrapErr(await client.download("brand/missing.png"));
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toContain("GcsStorageClient.download failed");
    expect(error.message).toContain("object not found");
  });
});

describe("GcsStorageClient — delete()", () => {
  function makeClient() {
    return new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
  }

  it("calls bucket(bucketName).file(path).delete()", async () => {
    const client = makeClient();
    await client.delete("brand/logo.png");
    expect(bucketSpy).toHaveBeenCalledWith("aoos");
    expect(fileSpy).toHaveBeenCalledWith("brand/logo.png");
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("resolves void on success", async () => {
    const client = makeClient();
    const result = unwrap(await client.delete("brand/logo.png"));
    expect(result).toBeUndefined();
  });

  it("surfaces a StorageError when delete() rejects", async () => {
    deleteSpy.mockRejectedValueOnce(new Error("permission denied"));
    const client = makeClient();
    const error = unwrapErr(await client.delete("brand/logo.png"));
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).toContain("GcsStorageClient.delete failed");
    expect(error.message).toContain("permission denied");
  });
});

describe("GcsStorageClient — getPublicUrl()", () => {
  it("returns the GCS public URL format for a top-level path", () => {
    const client = new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
    expect(client.getPublicUrl("brand/logo.png")).toBe(
      "https://storage.googleapis.com/aoos/brand/logo.png",
    );
  });

  it("returns the GCS public URL format for a nested path", () => {
    const client = new GcsStorageClient({ ...baseConfig, gcsCredentials: FAKE_CREDENTIALS_JSON });
    expect(client.getPublicUrl("ai-creatives/brief-001/video-1.mp4")).toBe(
      "https://storage.googleapis.com/aoos/ai-creatives/brief-001/video-1.mp4",
    );
  });
});
