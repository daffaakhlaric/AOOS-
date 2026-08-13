import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AssetService } from "../../../src/application/services/AssetService.js";
import { DefaultAssetTagger } from "../../../src/application/services/DefaultAssetTagger.js";
import { StorageService } from "../../../src/application/services/StorageService.js";
import { ArchiveAsset } from "../../../src/application/use-cases/ArchiveAsset.js";
import { ArchiveUnitAssets } from "../../../src/application/use-cases/ArchiveUnitAssets.js";
import { SaveAiCreative } from "../../../src/application/use-cases/SaveAiCreative.js";
import { TagAsset } from "../../../src/application/use-cases/TagAsset.js";
import { UploadAsset } from "../../../src/application/use-cases/UploadAsset.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetStatus } from "../../../src/domain/value-objects/AssetStatus.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { createFakeAssetStorage } from "../../helpers/assetStorage.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { unwrap } from "../../helpers/result.js";
import { createFakeSupabaseClient } from "../../helpers/supabase.js";

const config = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceKey: "key",
  gcsBucketName: "aoos",
  gcsProjectId: "fake-test-project",
  gcsKeyFilePath: "./fake-service-account.json",
  tenantId: "dss-motor",
  imageSizeLimitBytes: 10 * 1024 * 1024,
  videoSizeLimitBytes: 100 * 1024 * 1024,
};

function makeAssetService() {
  const repository = new AssetRepository(createFakeSupabaseClient());
  const storage = createFakeAssetStorage();
  const storageService = new StorageService(storage, config);
  const tagger = new DefaultAssetTagger();
  const events = new AssetLibraryEvents(createFakePublisher());

  const uploadAsset = new UploadAsset(repository, storageService, tagger, events);
  const tagAsset = new TagAsset(repository, events);
  const archiveAsset = new ArchiveAsset(repository, events);
  const archiveUnitAssets = new ArchiveUnitAssets(repository, events);
  const saveAiCreative = new SaveAiCreative(repository, storageService, tagger, events);

  return {
    service: new AssetService(
      uploadAsset,
      tagAsset,
      archiveAsset,
      archiveUnitAssets,
      saveAiCreative,
    ),
    repository,
  };
}

describe("AssetService (integration facade)", () => {
  it("upload() delegates to UploadAsset", async () => {
    const { service } = makeAssetService();
    const asset = unwrap(
      await service.upload({
        file: Buffer.alloc(10),
        fileName: "logo.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(asset.fileName).toBe("logo.png");
  });

  it("tag() delegates to TagAsset", async () => {
    const { service } = makeAssetService();
    const inserted = unwrap(
      await service.upload({
        file: Buffer.alloc(10),
        fileName: "logo1.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    const tagged = unwrap(
      await service.tag({
        id: inserted.id.toString(),
        tags: ["angle:front"],
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(tagged.tags.map((t) => t.toString())).toContain("angle:front");
  });

  it("archive() delegates to ArchiveAsset", async () => {
    const { service } = makeAssetService();
    const inserted = unwrap(
      await service.upload({
        file: Buffer.alloc(10),
        fileName: "logo2.png",
        mimeType: "image/png",
        type: AssetType.BRAND,
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    const archived = unwrap(
      await service.archive({
        id: inserted.id.toString(),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(archived.status).toBe(AssetStatus.ARCHIVED);
  });

  it("archiveUnit() delegates to ArchiveUnitAssets", async () => {
    const { service } = makeAssetService();
    await service.upload({
      file: Buffer.alloc(10),
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      type: AssetType.UNIT_PHOTO,
      unitId: "unit-1",
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    const result = await service.archiveUnit({
      unitId: "unit-1",
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(result.ok).toBe(true);
  });

  it("saveCreative() delegates to SaveAiCreative", async () => {
    const { service } = makeAssetService();
    const collection = unwrap(
      await service.saveCreative({
        imageBuffers: [Buffer.alloc(10)],
        creativeBriefId: "brief-1",
        branch: Branch.BINTARO,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(collection.count).toBe(1);
  });
});
