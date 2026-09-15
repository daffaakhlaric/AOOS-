import { AspectRatio, ImageModel, VideoModel } from "@aos/creative-connector";
import { describe, expect, it, vi } from "vitest";

import { CreativeOrchestratorService } from "../../../../src/application/services/CreativeOrchestratorService.js";
import { ImageSpec } from "../../../../src/domain/value-objects/ImageSpec.js";
import { VideoSpec } from "../../../../src/domain/value-objects/VideoSpec.js";
import {
  apiError,
  buildGeneratedImage,
  buildGeneratedVideo,
  buildUploadedFile,
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

function mockResponse(
  overrides: { ok?: boolean; status?: number; body?: ArrayBuffer } = {},
): Response {
  return {
    ok: overrides.ok ?? true,
    status: overrides.status ?? (overrides.ok === false ? 500 : 200),
    arrayBuffer: async () => overrides.body ?? new ArrayBuffer(8),
  } as Response;
}

function buildDeps() {
  const uploadSourceImage = { execute: vi.fn() };
  const generateLongVideo = { execute: vi.fn() };
  const generateImageSet = { execute: vi.fn() };
  const downloadMedia = { execute: vi.fn() };
  const fetchSourcePhoto = vi.fn();
  return {
    uploadSourceImage,
    generateLongVideo,
    generateImageSet,
    downloadMedia,
    fetchSourcePhoto,
  };
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

describe("CreativeOrchestratorService", () => {
  it("images-only: generates 3 images with no source photo and no video", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("img")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(result.imageBuffers).toHaveLength(3);
    expect(result.videoBuffer).toBeUndefined();
    expect(result.videoDelivered).toBe(false);
    expect(deps.uploadSourceImage.execute).not.toHaveBeenCalled();
    expect(deps.generateLongVideo.execute).not.toHaveBeenCalled();
  });

  it("with a source photo: fetches, uploads, and passes the fileUrl to generation calls", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
    deps.uploadSourceImage.execute.mockResolvedValue(
      okResult(buildUploadedFile("https://cdn.kie.ai/up-1.jpg")),
    );
    deps.generateLongVideo.execute.mockResolvedValue(okResult(buildGeneratedVideo()));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("media")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({
        sourcePhotoUrls: ["https://cdn.supabase.test/xpander.jpg"],
        sourcePhotoFileNames: ["xpander.jpg"],
        sourcePhotoMimeTypes: ["image/jpeg"],
        videoPrompt: "a video prompt",
        videoSpec: videoSpec(),
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );

    expect(result.videoDelivered).toBe(true);
    expect(result.videoBuffer).toBeDefined();
    expect(result.imageBuffers).toHaveLength(3);
    expect(deps.uploadSourceImage.execute).toHaveBeenCalledWith(
      expect.any(Buffer),
      "xpander.jpg",
      "image/jpeg",
      undefined,
      undefined,
    );
    const videoCallArg = deps.generateLongVideo.execute.mock.calls[0]?.[0];
    expect(videoCallArg.sourceImageUrls).toEqual(["https://cdn.kie.ai/up-1.jpg"]);
    const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
    expect(imageCallArg.requests[0].sourceImageUrls).toEqual(["https://cdn.kie.ai/up-1.jpg"]);
  });

  it(
    "REAL BUG FIX regression guard: uploads BOTH real source photos independently and sends " +
      "BOTH resulting Kie AI file URLs to both video and image generation (Kie AI's real, " +
      "confirmed-live reference-image limit is 2 — this used to only ever send 1)",
    async () => {
      const deps = buildDeps();
      deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
      deps.uploadSourceImage.execute
        .mockResolvedValueOnce(okResult(buildUploadedFile("https://cdn.kie.ai/up-1.jpg")))
        .mockResolvedValueOnce(okResult(buildUploadedFile("https://cdn.kie.ai/up-2.jpg")));
      deps.generateLongVideo.execute.mockResolvedValue(okResult(buildGeneratedVideo()));
      deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
      deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("media")));

      const service = new CreativeOrchestratorService(
        deps.uploadSourceImage,
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
        deps.fetchSourcePhoto,
      );

      const result = unwrap(
        await service.orchestrate({
          sourcePhotoUrls: [
            "https://cdn.supabase.test/photo-1.jpg",
            "https://cdn.supabase.test/photo-2.jpg",
          ],
          sourcePhotoFileNames: ["photo-1.jpg", "photo-2.jpg"],
          sourcePhotoMimeTypes: ["image/jpeg", "image/png"],
          videoPrompt: "a video prompt",
          videoSpec: videoSpec(),
          imagePrompts: ["p1", "p2", "p3"],
          imageSpec: imageSpec(),
        }),
      );

      expect(result.sourcePhotoSkippedReason).toBeUndefined();
      expect(deps.uploadSourceImage.execute).toHaveBeenCalledTimes(2);
      expect(deps.uploadSourceImage.execute).toHaveBeenNthCalledWith(
        1,
        expect.any(Buffer),
        "photo-1.jpg",
        "image/jpeg",
        undefined,
        undefined,
      );
      expect(deps.uploadSourceImage.execute).toHaveBeenNthCalledWith(
        2,
        expect.any(Buffer),
        "photo-2.jpg",
        "image/png",
        undefined,
        undefined,
      );
      const videoCallArg = deps.generateLongVideo.execute.mock.calls[0]?.[0];
      expect(videoCallArg.sourceImageUrls).toEqual([
        "https://cdn.kie.ai/up-1.jpg",
        "https://cdn.kie.ai/up-2.jpg",
      ]);
      const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
      expect(imageCallArg.requests[0].sourceImageUrls).toEqual([
        "https://cdn.kie.ai/up-1.jpg",
        "https://cdn.kie.ai/up-2.jpg",
      ]);
    },
  );

  it(
    "one of 2 source photos fails to upload -> still uses the one that succeeded, reports the " +
      "real reason for the one that didn't",
    async () => {
      const deps = buildDeps();
      deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
      deps.uploadSourceImage.execute
        .mockResolvedValueOnce(okResult(buildUploadedFile("https://cdn.kie.ai/up-1.jpg")))
        .mockResolvedValueOnce(errResult(apiError("second upload rejected")));
      deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
      deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

      const service = new CreativeOrchestratorService(
        deps.uploadSourceImage,
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
        deps.fetchSourcePhoto,
      );

      const result = unwrap(
        await service.orchestrate({
          sourcePhotoUrls: [
            "https://cdn.supabase.test/photo-1.jpg",
            "https://cdn.supabase.test/photo-2.jpg",
          ],
          imagePrompts: ["p1", "p2", "p3"],
          imageSpec: imageSpec(),
        }),
      );

      expect(result.sourcePhotoSkippedReason).toContain("second upload rejected");
      const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
      expect(imageCallArg.requests[0].sourceImageUrls).toEqual(["https://cdn.kie.ai/up-1.jpg"]);
    },
  );

  it("unsupported mimeType defaults to image/jpeg", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
    deps.uploadSourceImage.execute.mockResolvedValue(okResult(buildUploadedFile()));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    await service.orchestrate({
      sourcePhotoUrls: ["https://cdn.supabase.test/x.gif"],
      sourcePhotoMimeTypes: ["image/gif"],
      imagePrompts: ["p1", "p2", "p3"],
      imageSpec: imageSpec(),
    });

    expect(deps.uploadSourceImage.execute).toHaveBeenCalledWith(
      expect.any(Buffer),
      "source-photo-1.jpg",
      "image/jpeg",
      undefined,
      undefined,
    );
  });

  it("image/png mimeType is passed through unchanged", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
    deps.uploadSourceImage.execute.mockResolvedValue(okResult(buildUploadedFile()));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    await service.orchestrate({
      sourcePhotoUrls: ["https://cdn.supabase.test/x.png"],
      sourcePhotoMimeTypes: ["image/png"],
      imagePrompts: ["p1", "p2", "p3"],
      imageSpec: imageSpec(),
    });

    expect(deps.uploadSourceImage.execute).toHaveBeenCalledWith(
      expect.any(Buffer),
      "source-photo-1.jpg",
      "image/png",
      undefined,
      undefined,
    );
  });

  it("image/webp mimeType is passed through unchanged", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
    deps.uploadSourceImage.execute.mockResolvedValue(okResult(buildUploadedFile()));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    await service.orchestrate({
      sourcePhotoUrls: ["https://cdn.supabase.test/x.webp"],
      sourcePhotoMimeTypes: ["image/webp"],
      imagePrompts: ["p1", "p2", "p3"],
      imageSpec: imageSpec(),
    });

    expect(deps.uploadSourceImage.execute).toHaveBeenCalledWith(
      expect.any(Buffer),
      "source-photo-1.jpg",
      "image/webp",
      undefined,
      undefined,
    );
  });

  it("source photo fetch network failure -> falls back to no source photo (still generates images)", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockRejectedValue(new Error("network down"));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({
        sourcePhotoUrls: ["https://cdn.supabase.test/x.jpg"],
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(result.imageBuffers).toHaveLength(3);
    expect(deps.uploadSourceImage.execute).not.toHaveBeenCalled();
    // REAL BUG FIX regression guard: the real reason is preserved, not silently discarded.
    expect(result.sourcePhotoSkippedReason).toContain("network down");
  });

  it("source photo fetch HTTP error (non-ok) -> falls back to no source photo", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue(mockResponse({ ok: false, status: 403 }));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({
        sourcePhotoUrls: ["https://cdn.supabase.test/x.jpg"],
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(deps.uploadSourceImage.execute).not.toHaveBeenCalled();
    expect(result.sourcePhotoSkippedReason).toContain("403");
  });

  it("source photo response body read failure -> falls back to no source photo", async () => {
    const deps = buildDeps();
    deps.fetchSourcePhoto.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => {
        throw new Error("body read failed");
      },
    } as unknown as Response);
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({
        sourcePhotoUrls: ["https://cdn.supabase.test/x.jpg"],
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(deps.uploadSourceImage.execute).not.toHaveBeenCalled();
    expect(result.sourcePhotoSkippedReason).toContain("body read failed");
  });

  it(
    "REAL BUG FIX regression guard: source photo upload failure -> falls back to no source " +
      "photo, but names the real Kie AI upload error (found live: a real, publicly-fetchable " +
      "GCS photo still silently generated TEXT_2_VIDEO with zero trace of why)",
    async () => {
      const deps = buildDeps();
      deps.fetchSourcePhoto.mockResolvedValue(mockResponse());
      deps.uploadSourceImage.execute.mockResolvedValue(errResult(apiError("upload rejected")));
      deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
      deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

      const service = new CreativeOrchestratorService(
        deps.uploadSourceImage,
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
        deps.fetchSourcePhoto,
      );

      const result = unwrap(
        await service.orchestrate({
          sourcePhotoUrls: ["https://cdn.supabase.test/x.jpg"],
          imagePrompts: ["p1", "p2", "p3"],
          imageSpec: imageSpec(),
        }),
      );
      expect(result.sourcePhotoSkippedReason).toContain("upload rejected");
      expect(result.imageBuffers).toHaveLength(3);
      const imageCallArg = deps.generateImageSet.execute.mock.calls[0]?.[0];
      expect(imageCallArg.requests[0].sourceImageUrls).toEqual([]);
    },
  );

  it("no sourcePhotoUrl at all (no scraped photos for this unit) -> sourcePhotoSkippedReason is undefined, not a fabricated reason", async () => {
    const deps = buildDeps();
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const result = unwrap(
      await service.orchestrate({
        imagePrompts: ["p1", "p2", "p3"],
        imageSpec: imageSpec(),
      }),
    );
    expect(result.sourcePhotoSkippedReason).toBeUndefined();
  });

  it("video generation failure -> gracefully continues images-only (videoDelivered false)", async () => {
    const deps = buildDeps();
    deps.generateLongVideo.execute.mockResolvedValue(errResult(apiError("video gen failed")));
    deps.generateImageSet.execute.mockResolvedValue(okResult(threeSuccessfulImages()));
    deps.downloadMedia.execute.mockResolvedValue(okResult(Buffer.from("x")));

    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
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
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
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
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
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
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
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
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const error = unwrapErr(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(error.message).toContain("all 3 image generation(s) failed");
  });

  it(
    "REAL BUG FIX #2 (live-confirmed): when every source photo failed to upload AND every image " +
      "generation then failed, the GenerationError leads with the source-photo upload reason — the " +
      "real root cause (Kie AI silently fell back to text-to-image with no image_urls at all) — " +
      "not just the downstream Kie AI failure symptom",
    async () => {
      const deps = buildDeps();
      deps.fetchSourcePhoto.mockResolvedValue(mockResponse({ ok: false, status: 403 }));
      deps.generateImageSet.execute.mockResolvedValue(
        okResult({
          succeeded: [],
          failed: [
            { index: 0, error: apiError("HTTP 404") },
            { index: 1, error: apiError("HTTP 404") },
            { index: 2, error: apiError("HTTP 404") },
          ],
        }),
      );

      const service = new CreativeOrchestratorService(
        deps.uploadSourceImage,
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
        deps.fetchSourcePhoto,
      );

      const error = unwrapErr(
        await service.orchestrate({
          sourcePhotoUrls: ["https://cdn.supabase.test/listing-photo.jpg"],
          imagePrompts: ["p1", "p2", "p3"],
          imageSpec: imageSpec(),
        }),
      );
      expect(error.message).toContain("source photo upload:");
      expect(error.message).toContain("403");
      expect(error.message).toContain("HTTP 404");
    },
  );

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
        deps.uploadSourceImage,
        deps.generateLongVideo,
        deps.generateImageSet,
        deps.downloadMedia,
        deps.fetchSourcePhoto,
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
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
      deps.fetchSourcePhoto,
    );

    const error = unwrapErr(
      await service.orchestrate({ imagePrompts: ["p1", "p2", "p3"], imageSpec: imageSpec() }),
    );
    expect(error.message).toContain("failed");
  });

  it("defaults fetchSourcePhoto to the global fetch when not provided", () => {
    const deps = buildDeps();
    const service = new CreativeOrchestratorService(
      deps.uploadSourceImage,
      deps.generateLongVideo,
      deps.generateImageSet,
      deps.downloadMedia,
    );
    expect(service).toBeInstanceOf(CreativeOrchestratorService);
  });
});
