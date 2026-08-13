import type { GetAssetsByUnit, SaveAiCreative } from "@aos/asset-library";
import { AssetType, AssetError } from "@aos/asset-library";
import type {
  DownloadMedia,
  GenerateImageSet,
  GenerateLongVideo,
  UploadSourceImage,
} from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import { GenerationStatus } from "../../src/domain/value-objects/GenerationStatus.js";
import { KaiAgentFactory } from "../../src/factories/KaiAgentFactory.js";
import { buildBrief } from "../fixtures/creativeBriefFixtures.js";
import {
  apiError,
  buildAsset,
  buildAssetCollection,
  errResult,
  okResult,
  RecordingPublisher,
} from "../helpers/mocks.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

function imageSetResult(urls: readonly string[], failedCount = 0) {
  return {
    succeeded: urls.map((url, index) => ({ index, image: { imageUrl: { toString: () => url } } })),
    failed: Array.from({ length: failedCount }, (_, i) => ({
      index: urls.length + i,
      error: apiError(`image ${String(urls.length + i)} failed`),
    })),
  };
}

function buildRuntime(overrides: {
  readonly photoCount?: number;
  readonly videoResult?: unknown;
  readonly imageSetResult?: unknown;
  readonly saveResult?: unknown;
}) {
  const photos = buildAssetCollection(
    Array.from({ length: overrides.photoCount ?? 0 }, () => buildAsset()),
  );

  const getAssetsByUnit = {
    execute: vi.fn().mockResolvedValue(okResult(photos)),
  } as unknown as GetAssetsByUnit;
  const uploadSourceImage = {
    execute: vi
      .fn()
      .mockResolvedValue(okResult({ fileUrl: { toString: () => "https://cdn.kie.ai/up.jpg" } })),
  } as unknown as UploadSourceImage;
  const generateLongVideo = {
    execute: vi
      .fn()
      .mockResolvedValue(
        overrides.videoResult ??
          okResult({ videoUrl: { toString: () => "https://cdn.kie.ai/video.mp4" } }),
      ),
  } as unknown as GenerateLongVideo;
  const generateImageSet = {
    execute: vi
      .fn()
      .mockResolvedValue(
        okResult(
          overrides.imageSetResult ??
            imageSetResult([
              "https://cdn.kie.ai/i0.jpg",
              "https://cdn.kie.ai/i1.jpg",
              "https://cdn.kie.ai/i2.jpg",
            ]),
        ),
      ),
  } as unknown as GenerateImageSet;
  const downloadMedia = {
    execute: vi.fn().mockResolvedValue(okResult(Buffer.from("media"))),
  } as unknown as DownloadMedia;
  const saveAiCreative = {
    execute: vi
      .fn()
      .mockResolvedValue(
        overrides.saveResult ??
          okResult(
            buildAssetCollection([
              buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-1.jpg" }),
              buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-2.jpg" }),
              buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-3.jpg" }),
              buildAsset({
                type: AssetType.AI_VIDEO,
                publicUrl: "https://cdn.test/saved-video.mp4",
              }),
            ]),
          ),
      ),
  } as unknown as SaveAiCreative;

  const publisher = new RecordingPublisher();
  const runtime = unwrap(
    KaiAgentFactory.create({
      config: { tenantId: "dss-motor" },
      publisher,
      getAssetsByUnit,
      saveAiCreative,
      uploadSourceImage,
      generateLongVideo,
      generateImageSet,
      downloadMedia,
    }),
  );

  return { runtime, publisher, saveAiCreative, generateImageSet, generateLongVideo };
}

describe("ProcessCreativeBrief (integration)", () => {
  it("brief with photos -> VIDEO_AND_IMAGES -> package with videoUrl + 3 imageUrls + 3 copy variants", async () => {
    const { runtime } = buildRuntime({ photoCount: 3 });
    const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_SQUARE"], urgency: "HIGH" });

    const pkg = unwrap(await runtime.processCreativeBrief.execute(brief));

    expect(pkg.status).toBe(GenerationStatus.READY);
    expect(pkg.videoUrl).toBe("https://cdn.test/saved-video.mp4");
    expect(pkg.imageUrls).toHaveLength(3);
    expect(pkg.copyVariants).toHaveLength(3);
  });

  it("brief without photos -> IMAGES_ONLY -> package with 3 imageUrls + 3 copy variants, no video", async () => {
    const saveResult = okResult(
      buildAssetCollection([
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-1.jpg" }),
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-2.jpg" }),
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-3.jpg" }),
      ]),
    );
    const { runtime } = buildRuntime({ photoCount: 0, saveResult });
    const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_SQUARE"], urgency: "HIGH" });

    const pkg = unwrap(await runtime.processCreativeBrief.execute(brief));

    expect(pkg.videoUrl).toBeUndefined();
    expect(pkg.imageUrls).toHaveLength(3);
    expect(pkg.copyVariants).toHaveLength(3);
  });

  it("video generation fails -> falls back to IMAGES_ONLY -> no error, package still READY", async () => {
    const saveResult = okResult(
      buildAssetCollection([
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-1.jpg" }),
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-2.jpg" }),
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-3.jpg" }),
      ]),
    );
    const { runtime } = buildRuntime({
      photoCount: 3,
      videoResult: errResult(apiError("Kie AI video generation failed")),
      saveResult,
    });
    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });

    const pkg = unwrap(await runtime.processCreativeBrief.execute(brief));

    expect(pkg.status).toBe(GenerationStatus.READY);
    expect(pkg.videoUrl).toBeUndefined();
    expect(pkg.imageUrls).toHaveLength(3);
  });

  it("1 of 3 images fails -> package has 2 imageUrls (graceful)", async () => {
    const saveResult = okResult(
      buildAssetCollection([
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-1.jpg" }),
        buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/saved-2.jpg" }),
      ]),
    );
    const { runtime } = buildRuntime({
      photoCount: 0,
      imageSetResult: imageSetResult(["https://cdn.kie.ai/i0.jpg", "https://cdn.kie.ai/i1.jpg"], 1),
      saveResult,
    });
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });

    const pkg = unwrap(await runtime.processCreativeBrief.execute(brief));
    expect(pkg.imageUrls).toHaveLength(2);
  });

  it("all images fail -> CreativeGenerationFailed emitted, use case returns an error", async () => {
    const { runtime, publisher } = buildRuntime({
      photoCount: 0,
      imageSetResult: imageSetResult([], 3),
    });
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });

    const error = unwrapErr(await runtime.processCreativeBrief.execute(brief));
    expect(error.name).toBe("GenerationError");

    const failedEvent = publisher.published.find(
      (e) => e.type === "aaos.creative.generation.failed",
    );
    expect(failedEvent).toBeDefined();
  });

  it("CreativePackageReady event emitted with the correct packageId", async () => {
    const { runtime, publisher } = buildRuntime({ photoCount: 0 });
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });

    const pkg = unwrap(await runtime.processCreativeBrief.execute(brief));

    const readyEvent = publisher.published.find((e) => e.type === "aaos.creative.package.ready");
    expect(readyEvent).toBeDefined();
    expect((readyEvent?.payload as { packageId: string }).packageId).toBe(pkg.id.toString());
  });

  it("assets stored in asset-library after generation (SaveAiCreative called with expected shape)", async () => {
    const { runtime, saveAiCreative } = buildRuntime({ photoCount: 0 });
    const brief = buildBrief({ formats: ["IMAGE_SQUARE"] });

    await runtime.processCreativeBrief.execute(brief);

    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        creativeBriefId: brief.id.toString(),
        unitId: brief.unit,
        branch: brief.branch,
        tenantId: "dss-motor",
      }),
    );
  });

  it("asset-library query failure surfaces as NoSourcePhotosError (not silently swallowed)", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(errResult(new AssetError("connection refused"))),
    } as unknown as GetAssetsByUnit;
    const bundle = buildRuntime({ photoCount: 0 });
    const publisher = new RecordingPublisher();
    const failingRuntime = unwrap(
      KaiAgentFactory.create({
        config: { tenantId: "dss-motor" },
        publisher,
        getAssetsByUnit,
        saveAiCreative: bundle.saveAiCreative,
        uploadSourceImage: { execute: vi.fn() } as unknown as UploadSourceImage,
        generateLongVideo: bundle.generateLongVideo,
        generateImageSet: bundle.generateImageSet,
        downloadMedia: { execute: vi.fn() } as unknown as DownloadMedia,
      }),
    );

    const error = unwrapErr(await failingRuntime.processCreativeBrief.execute(buildBrief()));
    expect(error.name).toBe("NoSourcePhotosError");
  });
});
