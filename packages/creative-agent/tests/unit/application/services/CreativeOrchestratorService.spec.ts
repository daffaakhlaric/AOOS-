import { AspectRatio, ImageModel, VideoModel } from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import { CreativeOrchestratorService } from "../../../../src/application/services/CreativeOrchestratorService.js";
import { ImageSpec } from "../../../../src/domain/value-objects/ImageSpec.js";
import { VideoSpec } from "../../../../src/domain/value-objects/VideoSpec.js";
import {
  apiError,
  buildGeneratedImage,
  buildGeneratedVideo,
  errResult,
  okResult,
} from "../../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

function imageSpec(): ImageSpec {
  return unwrap(
    ImageSpec.create({
      count: 3,
      aspectRatio: AspectRatio.SQUARE,
      model: ImageModel.NANO_BANANA_PRO,
    }),
  );
}

function videoSpec(): VideoSpec {
  return unwrap(
    VideoSpec.create({
      durationSeconds: 8,
      aspectRatio: AspectRatio.WIDESCREEN,
      model: VideoModel.VEO3_FAST,
    }),
  );
}

function buildDeps() {
  const generateLongVideo = { execute: vi.fn() };
  const generateImageSet = { execute: vi.fn() };
  const downloadMedia = { execute: vi.fn() };
  return { generateLongVideo, generateImageSet, downloadMedia };
}

function threeSuccessfulImages() {
  return {
    succeeded: [
      { index: 0, image: buildGeneratedImage("https://cdn.kie.ai/img-0.jpg") },
      { index: 1, image: buildGeneratedImage("https://cdn.kie.ai/img-1.jpg") },
      { index: 2, image: buildGeneratedImage("https://cdn.kie.ai/img-2.jpg") },
    ],
    failed: [],
  };
}

// REAL BUG FIX (live-confirmed, 2026-09-15): CreativeOrchestratorService no longer re-uploads
// source photos to Kie AI's own file host before generation — two real, compounding bugs on that
// path (a schema mismatch, and Kie AI's generation endpoints not reliably recognizing a
// freshly-uploaded file's own URL) made the whole indirection pointless. `sourcePhotoUrls` (this
// codebase's own real, already-public GCS URLs) are passed straight through to
// generateLongVideo/generateImageSet instead. See CreativeOrchestratorService's own class doc.
describe("CreativeOrchestratorService", () => {
  it("images-only: generates 3 images with no source photo and no video", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("img")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const result = unwrap(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(result.imageBuffers).toHaveLength(3);
    expect(result.videoBuffer).toBeUndefined();
    expect(result.videoDelivered).toBe(false);
    expect(deps.generateLongVideo.execute).not.toHaveBeenCalled();
  });

  it("with source photos: passes the real, already-public sourcePhotoUrls straight through to video and image generation, no re-upload hop", async () => {
    const deps = buildDeps();
    deps.generateLongVideo.execute.mockResolvedValue(okResult(buildGeneratedVideo()));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("media")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const result = unwrap(
      await service.orchestrate({
        sourcePhotoUrls: [
          "https://storage.googleapis.com/aoos/listings/x/photo-1.jpg",
          "https://storage.googleapis.com/aoos/listings/x/photo-2.jpg",
        ],
        videoPrompt: "a video prompt",
        videoSpec: videoSpec(),
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );

    expect(result.videoDelivered).toBe(true);
    expect(result.videoBuffer).toBeDefined();
    expect(result.imageBuffers).toHaveLength(3);
    const videoCallArg = deps.generateLongVideo.execute.mock.calls[0]?.[0];
    expect(videoCallArg.sourceImageUrls).toEqual([
      "https://storage.googleapis.com/aoos/listings/x/photo-1.jpg",
      "https://storage.googleapis.com/aoos/listings/x/photo-2.jpg",
    ]);
    const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
    expect(imageCallArg.requests[0].sourceImageUrls).toEqual([
      "https://storage.googleapis.com/aoos/listings/x/photo-1.jpg",
      "https://storage.googleapis.com/aoos/listings/x/photo-2.jpg",
    ]);
  });

  it("no sourcePhotoUrls at all -> generation proceeds with an empty sourceImageUrls array, never fabricated", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() });
    const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
    expect(imageCallArg.requests[0].sourceImageUrls).toEqual([]);
  });

  it("video generation failure -> gracefully continues images-only (videoDelivered false)", async () => {
    const deps = buildDeps();
    deps.generateLongVideo.execute.mockResolvedValue(errResult(apiError("video gen failed")));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const result = unwrap(
      await service.orchestrate({
        videoPrompt: "prompt",
        videoSpec: videoSpec(),
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(result.videoDelivered).toBe(false);
    expect(result.videoBuffer).toBeUndefined();
    expect(result.imageBuffers).toHaveLength(3);
  });

  it("video media download failure -> gracefully continues images-only", async () => {
    const deps = buildDeps();
    deps.generateLongVideo.execute.mockResolvedValue(okResult(buildGeneratedVideo()));
    let call = 0;
    deps.downloadMedia.execute.mockImplementation(async () => {
      call += 1;
      // first call is the video download; fail it, succeed subsequent (image) calls.
      return call === 1
        ? errResult(apiError("video download failed"))
        : okResult(Buffer.from("img"));
    });
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const result = unwrap(
      await service.orchestrate({
        videoPrompt: "prompt",
        videoSpec: videoSpec(),
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(result.videoDelivered).toBe(false);
    expect(result.imageBuffers).toHaveLength(3);
  });

  it("1 of 3 images fails in GenerateImageSet -> continues with the 2 that succeeded", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(
      okResult({
        succeeded: [
          { index: 0, image: buildGeneratedImage("https://cdn.kie.ai/img-0.jpg") },
          { index: 2, image: buildGeneratedImage("https://cdn.kie.ai/img-2.jpg") },
        ],
        failed: [{ index: 1, error: apiError("image 1 failed") }],
      }),
    );
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("img")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const result = unwrap(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(result.imageBuffers).toHaveLength(2);
  });

  it("succeeded images are downloaded in ascending index order regardless of array order", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(
      okResult({
        succeeded: [
          { index: 2, image: buildGeneratedImage("https://cdn.kie.ai/img-2.jpg") },
          { index: 0, image: buildGeneratedImage("https://cdn.kie.ai/img-0.jpg") },
          { index: 1, image: buildGeneratedImage("https://cdn.kie.ai/img-1.jpg") },
        ],
        failed: [],
      }),
    );
    const downloadOrder: string[] = [];
    deps.downloadMedia.execute.mockImplementation(async (url: { toString(): string }) => {
      downloadOrder.push(url.toString());
      return okResult(Buffer.from("img"));
    });

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() });
    expect(downloadOrder).toEqual([
      "https://cdn.kie.ai/img-0.jpg",
      "https://cdn.kie.ai/img-1.jpg",
      "https://cdn.kie.ai/img-2.jpg",
    ]);
  });

  it("all image generations fail -> returns a GenerationError", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(
      okResult({
        succeeded: [],
        failed: [
          { index: 0, error: apiError("fail 0") },
          { index: 1, error: apiError("fail 1") },
          { index: 2, error: apiError("fail 2") },
        ],
      }),
    );

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const error = unwrapErr(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(error.message).toContain("all 3 image generation(s) failed");
  });

  it(
    "REAL BUG FIX regression guard: includes the real per-request failure reasons in the " +
      "GenerationError message, not just a count (previously discarded, leaving no way to tell a " +
      "Kie AI auth/quota error apart from a bad prompt apart from a timeout)",
    async () => {
      const deps = buildDeps();
      deps.generateImageSet.execute.mockResolvedValue(
        okResult({
          succeeded: [],
          failed: [
            { index: 0, error: apiError("insufficient credits") },
            { index: 1, error: apiError("insufficient credits") },
            { index: 2, error: apiError("insufficient credits") },
          ],
        }),
      );

      const service = new CreativeOrchestratorService(
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
      );

      const error = unwrapErr(
        await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
      );
      expect(error.message).toContain("insufficient credits");
    },
  );

  it("all image downloads fail (even though generation succeeded) -> returns a GenerationError", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(errResult(apiError("download failed")));

    const service = new CreativeOrchestratorService(
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );

    const error = unwrapErr(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(error.message).toContain("failed");
  });
});
