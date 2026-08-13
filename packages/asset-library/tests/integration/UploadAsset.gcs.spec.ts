import { beforeEach, describe, expect, it, vi } from "vitest";

import { DefaultAssetTagger } from "../../src/application/services/DefaultAssetTagger.js";
import { StorageService } from "../../src/application/services/StorageService.js";
import { UploadAsset } from "../../src/application/use-cases/UploadAsset.js";
import { AssetLibraryEvents } from "../../src/domain/events/AssetLibraryEvents.js";
import { AssetType } from "../../src/domain/value-objects/AssetType.js";
import { GcsStorageClient } from "../../src/infrastructure/gcs/GcsStorageClient.js";
import { AssetRepository } from "../../src/infrastructure/supabase/AssetRepository.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";
import { createFakeSupabaseClient } from "../helpers/supabase.js";

/**
 * End-to-end coverage of `UploadAsset` wired to a real `GcsStorageClient` (mocked
 * `@google-cloud/storage` SDK — zero real network calls) rather than the generic
 * `FakeAssetStorage` test double every other integration spec uses. Confirms the whole vertical
 * slice — `UploadAsset` -> `StorageService` -> `GcsStorageClient` -> `@google-cloud/storage` ->
 * `https://storage.googleapis.com/{bucket}/{path}` — produces the exact GCS public URL format
 * (spec's pinned "integration/UploadAsset.gcs.spec.ts" test).
 */
const { saveSpy } = vi.hoisted(() => ({
  saveSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@google-cloud/storage", () => {
  class FakeStorage {
    bucket() {
      return {
        file: (path: string) => ({
          save: (buffer: Buffer, options: unknown) => saveSpy(path, buffer, options),
        }),
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

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  gcsBucketName: "aoos",
  gcsProjectId: "fake-test-project",
  gcsCredentials: FAKE_CREDENTIALS_JSON,
  tenantId: "dss-motor",
  imageSizeLimitBytes: 10 * 1024 * 1024,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

beforeEach(() => {
  saveSpy.mockClear();
  saveSpy.mockResolvedValue(undefined);
});

function makeUploadAsset() {
  const repository = new AssetRepository(createFakeSupabaseClient());
  const storage = new GcsStorageClient(config);
  const storageService = new StorageService(storage, config);
  const events = new AssetLibraryEvents(createFakePublisher());
  return new UploadAsset(
    repository,
    storageService,
    new DefaultAssetTagger(),
    events,
    () => new Date("2026-01-01T00:00:00.000Z"),
  );
}

describe("UploadAsset (GCS integration)", () => {
  it("uploads to GCS and returns the gs://aoos/{path} public URL", async () => {
    const uploadAsset = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(1024),
        fileName: "logo.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.publicUrl.toString()).toBe(`https://storage.googleapis.com/aoos/brand/logo.png`);
    expect(saveSpy).toHaveBeenCalledWith(
      "brand/logo.png",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png" }),
    );
  });

  it("uploads a unit photo and returns the correct nested GCS URL", async () => {
    const uploadAsset = makeUploadAsset();
    const asset = unwrap(
      await uploadAsset.execute({
        file: Buffer.alloc(1024),
        fileName: "photo-1.jpg",
        mimeType: "image/jpeg",
        type: AssetType.UNIT_PHOTO,
        unitId: "unit-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.publicUrl.toString()).toMatch(
      /^https:\/\/storage\.googleapis\.com\/aoos\/units\/unit-1\/photo-\d+\.jpg$/,
    );
  });
});
