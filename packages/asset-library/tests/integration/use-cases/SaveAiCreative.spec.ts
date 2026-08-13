import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { DefaultAssetTagger } from "../../../src/application/services/DefaultAssetTagger.js";
import { StorageService } from "../../../src/application/services/StorageService.js";
import { SaveAiCreative } from "../../../src/application/use-cases/SaveAiCreative.js";
import { AssetLibraryEvents } from "../../../src/domain/events/AssetLibraryEvents.js";
import { AssetType } from "../../../src/domain/value-objects/AssetType.js";
import { AssetRepository } from "../../../src/infrastructure/supabase/AssetRepository.js";
import { createFakeAssetStorage } from "../../helpers/assetStorage.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { AssetError, createStubAssetRepository, err } from "../../helpers/repository.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";
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

function makeSaveAiCreative(now = () => new Date("2026-01-01T00:00:00.000Z")) {
  const client = createFakeSupabaseClient();
  const storage = createFakeAssetStorage();
  const repository = new AssetRepository(client);
  const storageService = new StorageService(storage, config);
  const publisher = createFakePublisher();
  const events = new AssetLibraryEvents(publisher);
  const saveAiCreative = new SaveAiCreative(
    repository,
    storageService,
    new DefaultAssetTagger(),
    events,
    now,
  );
  return { saveAiCreative, repository, publisher };
}

describe("SaveAiCreative (integration)", () => {
  it("video + 3 images -> AssetCollection", async () => {
    const { saveAiCreative } = makeSaveAiCreative();
    const collection = unwrap(
      await saveAiCreative.execute({
        videoBuffer: Buffer.alloc(1024),
        imageBuffers: [Buffer.alloc(10), Buffer.alloc(10), Buffer.alloc(10)],
        creativeBriefId: "brief-001",
        branch: Branch.BINTARO,
        aiPrompt: "a red Xpander",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(collection.count).toBe(4);
    const imageAssets = collection.assets.filter((a) => a.type === AssetType.AI_IMAGE);
    const videoAssets = collection.assets.filter((a) => a.type === AssetType.AI_VIDEO);
    expect(imageAssets).toHaveLength(3);
    expect(videoAssets).toHaveLength(1);
    expect(imageAssets.map((a) => a.storagePath.toString())).toEqual([
      "ai-creatives/brief-001/image-1.jpg",
      "ai-creatives/brief-001/image-2.jpg",
      "ai-creatives/brief-001/image-3.jpg",
    ]);
    expect(videoAssets[0]?.storagePath.toString()).toBe("ai-creatives/brief-001/video-1.mp4");
  });

  it("emits a CollectionUpdated event", async () => {
    const { saveAiCreative, publisher } = makeSaveAiCreative();
    await saveAiCreative.execute({
      imageBuffers: [Buffer.alloc(10)],
      creativeBriefId: "brief-002",
      branch: Branch.CINERE,
      aiPrompt: "prompt",
      aiModel: "veo",
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.assets.collection.updated");
  });

  it("tags every asset with the creativeBriefId", async () => {
    const { saveAiCreative } = makeSaveAiCreative();
    const collection = unwrap(
      await saveAiCreative.execute({
        imageBuffers: [Buffer.alloc(10), Buffer.alloc(10)],
        creativeBriefId: "brief-003",
        branch: Branch.BANDUNG,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(collection.assets.every((asset) => asset.creativeBriefId === "brief-003")).toBe(true);
  });

  it("rejects when neither videoBuffer nor imageBuffers are provided", async () => {
    const { saveAiCreative } = makeSaveAiCreative();
    const error = unwrapErr(
      await saveAiCreative.execute({
        imageBuffers: [],
        creativeBriefId: "brief-004",
        branch: Branch.UMUM,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("at least one of videoBuffer or imageBuffers");
  });

  it("rejects invalid input via Zod validation", async () => {
    const { saveAiCreative } = makeSaveAiCreative();
    const error = unwrapErr(
      await saveAiCreative.execute({
        imageBuffers: [Buffer.alloc(10)],
        creativeBriefId: "",
        branch: Branch.UMUM,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("SaveAiCreative input validation failed");
  });

  it("propagates a storage error for an image", async () => {
    const client = createFakeSupabaseClient();
    const storage = createFakeAssetStorage();
    storage.forceErrorOnce("disk full");
    const repository = new AssetRepository(client);
    const storageService = new StorageService(storage, config);
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const saveAiCreative = new SaveAiCreative(
      repository,
      storageService,
      new DefaultAssetTagger(),
      events,
    );

    const error = unwrapErr(
      await saveAiCreative.execute({
        imageBuffers: [Buffer.alloc(10)],
        creativeBriefId: "brief-005",
        branch: Branch.UMUM,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.name).toBe("StorageError");
  });

  it("propagates a repository insert error for the video asset", async () => {
    const storage = createFakeAssetStorage();
    const storageService = new StorageService(storage, config);
    const publisher = createFakePublisher();
    const events = new AssetLibraryEvents(publisher);
    const failingRepository = createStubAssetRepository({
      insert: async () => err(new AssetError("insert failed")),
    });
    const saveAiCreative = new SaveAiCreative(
      failingRepository,
      storageService,
      new DefaultAssetTagger(),
      events,
    );

    const error = unwrapErr(
      await saveAiCreative.execute({
        videoBuffer: Buffer.alloc(10),
        imageBuffers: [],
        creativeBriefId: "brief-006",
        branch: Branch.UMUM,
        aiPrompt: "prompt",
        aiModel: "veo",
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );
    expect(error.message).toContain("insert failed");
  });
});
