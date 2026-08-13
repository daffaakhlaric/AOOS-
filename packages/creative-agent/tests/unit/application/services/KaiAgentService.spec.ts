import { AssetType, AssetError } from "@aos/asset-library";
import { describe, expect, it, vi } from "vitest";

import { CopyGenerationService } from "../../../../src/application/services/CopyGenerationService.js";
import type { CreativeOrchestratorService } from "../../../../src/application/services/CreativeOrchestratorService.js";
import { FormatDecisionService } from "../../../../src/application/services/FormatDecisionService.js";
import { KaiAgentService } from "../../../../src/application/services/KaiAgentService.js";
import { PromptBuildingService } from "../../../../src/application/services/PromptBuildingService.js";
import type { CreativeAgentConfig } from "../../../../src/config/CreativeAgentConfig.js";
import { GenerationError } from "../../../../src/domain/errors/GenerationError.js";
import { CreativeAgentEvents } from "../../../../src/domain/events/CreativeAgentEvents.js";
import { GenerationStatus } from "../../../../src/domain/value-objects/GenerationStatus.js";
import { AutomotivePromptBuilder } from "../../../../src/intelligence/AutomotivePromptBuilder.js";
import { CopyBuilder } from "../../../../src/intelligence/CopyBuilder.js";
import { FormatDecider } from "../../../../src/intelligence/FormatDecider.js";
import { GenerationJobRegistry } from "../../../../src/registry/GenerationJobRegistry.js";
import { buildBrief } from "../../../fixtures/creativeBriefFixtures.js";
import {
  buildAsset,
  buildAssetCollection,
  RecordingPublisher,
  errResult,
  okResult,
} from "../../../helpers/mocks.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

const CONFIG: CreativeAgentConfig = {
  tenantId: "dss-motor",
  agentName: "Kai",
  defaultVideoModel: "veo3_fast",
  defaultImageCount: 3,
  videoFallbackOnError: true,
  maxGenerationWaitMs: 600_000,
};

function buildService(options: {
  readonly getAssetsByUnit: { execute: ReturnType<typeof vi.fn> };
  readonly saveAiCreative: { execute: ReturnType<typeof vi.fn> };
  readonly orchestrate: ReturnType<typeof vi.fn>;
  readonly publisher?: RecordingPublisher;
  readonly copyGenerationService?: CopyGenerationService;
}) {
  const publisher = options.publisher ?? new RecordingPublisher();
  const events = new CreativeAgentEvents(publisher);
  const jobRegistry = new GenerationJobRegistry();
  const orchestratorService = {
    orchestrate: options.orchestrate,
  } as unknown as CreativeOrchestratorService;

  const service = new KaiAgentService(
    options.getAssetsByUnit,
    options.saveAiCreative,
    new FormatDecisionService(new FormatDecider()),
    new PromptBuildingService(new AutomotivePromptBuilder()),
    options.copyGenerationService ?? new CopyGenerationService(new CopyBuilder(), events),
    orchestratorService,
    events,
    jobRegistry,
    CONFIG,
    () => new Date("2026-08-11T10:00:00.000Z"),
  );

  return { service, publisher, jobRegistry };
}

function savedImageAndVideoAssets() {
  return buildAssetCollection([
    buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/ai-img-1.jpg" }),
    buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/ai-img-2.jpg" }),
    buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/ai-img-3.jpg" }),
    buildAsset({ type: AssetType.AI_VIDEO, publicUrl: "https://cdn.test/ai-video-1.mp4" }),
  ]);
}

function savedImagesOnlyAssets() {
  return buildAssetCollection([
    buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/ai-img-1.jpg" }),
    buildAsset({ type: AssetType.AI_IMAGE, publicUrl: "https://cdn.test/ai-img-2.jpg" }),
  ]);
}

describe("KaiAgentService", () => {
  it("happy path with photos + video -> READY package with video, images, and 3 copy variants", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([buildAsset()]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImageAndVideoAssets())),
    };
    const orchestrate = vi.fn().mockResolvedValue(
      okResult({
        videoBuffer: Buffer.from("v"),
        imageBuffers: [Buffer.from("i1"), Buffer.from("i2"), Buffer.from("i3")],
        imageSpecs: [],
        videoDelivered: true,
      }),
    );
    const { service, publisher, jobRegistry } = buildService({
      getAssetsByUnit,
      saveAiCreative,
      orchestrate,
    });

    const brief = buildBrief({ formats: ["VIDEO_15S", "IMAGE_SQUARE"], urgency: "HIGH" });
    const pkg = unwrap(await service.processCreativeBrief(brief));

    expect(pkg.status).toBe(GenerationStatus.READY);
    expect(pkg.videoUrl).toBe("https://cdn.test/ai-video-1.mp4");
    expect(pkg.imageUrls).toHaveLength(3);
    expect(pkg.copyVariants).toHaveLength(3);
    expect(pkg.confidenceScore.toNumber()).toBe(100);

    const started = publisher.published.find((e) => e.type === "aaos.creative.generation.started");
    const ready = publisher.published.find((e) => e.type === "aaos.creative.package.ready");
    expect(started).toBeDefined();
    expect(ready).toBeDefined();

    const job = jobRegistry.all()[0];
    expect(job?.status).toBe(GenerationStatus.READY);
    expect(job?.packageId?.equals(pkg.id)).toBe(true);
  });

  it("no photos available -> IMAGES_ONLY, orchestrate called with no sourcePhotoUrl", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({
          imageBuffers: [Buffer.from("i1"), Buffer.from("i2")],
          imageSpecs: [],
          videoDelivered: false,
        }),
      );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
    const pkg = unwrap(await service.processCreativeBrief(brief));

    expect(pkg.videoUrl).toBeUndefined();
    expect(orchestrate).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePhotoUrl: undefined, videoPrompt: undefined }),
    );
  });

  it("photo query failure -> NoSourcePhotosError, job marked FAILED, CreativeGenerationFailed emitted", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(errResult(new AssetError("db timeout"))),
    };
    const saveAiCreative = { execute: vi.fn() };
    const orchestrate = vi.fn();
    const { service, publisher, jobRegistry } = buildService({
      getAssetsByUnit,
      saveAiCreative,
      orchestrate,
    });

    const error = unwrapErr(await service.processCreativeBrief(buildBrief()));
    expect(error.name).toBe("NoSourcePhotosError");
    expect(orchestrate).not.toHaveBeenCalled();

    const failed = publisher.published.find((e) => e.type === "aaos.creative.generation.failed");
    expect(failed).toBeDefined();
    expect(jobRegistry.all()[0]?.status).toBe(GenerationStatus.FAILED);
  });

  it("total image generation failure -> propagates the orchestrator's GenerationError", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = { execute: vi.fn() };
    const orchestrate = vi.fn().mockResolvedValue(errResult(new GenerationError("all failed")));
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    const error = unwrapErr(await service.processCreativeBrief(buildBrief()));
    expect(error.message).toBe("all failed");
    expect(saveAiCreative.execute).not.toHaveBeenCalled();
  });

  it("asset-library persistence failure -> GenerationError, job marked FAILED", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(errResult(new AssetError("storage full"))),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const { service, jobRegistry } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    const error = unwrapErr(await service.processCreativeBrief(buildBrief()));
    expect(error.name).toBe("GenerationError");
    expect(error.message).toContain("persist generated creative");
    expect(jobRegistry.all()[0]?.status).toBe(GenerationStatus.FAILED);
  });

  it("video requested but NOT delivered (graceful fallback) -> package still READY with videoUrl undefined", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([buildAsset()]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({
          imageBuffers: [Buffer.from("i1"), Buffer.from("i2")],
          imageSpecs: [],
          videoDelivered: false,
        }),
      );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    const brief = buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" });
    const pkg = unwrap(await service.processCreativeBrief(brief));

    expect(pkg.status).toBe(GenerationStatus.READY);
    expect(pkg.videoUrl).toBeUndefined();
    // Passed to saveAiCreative with no videoBuffer, since the orchestrator reported none delivered.
    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({ videoBuffer: undefined }),
    );
  });

  it("aiModel description combines video+image models when video is delivered", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([buildAsset()]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImageAndVideoAssets())),
    };
    const orchestrate = vi.fn().mockResolvedValue(
      okResult({
        videoBuffer: Buffer.from("v"),
        imageBuffers: [Buffer.from("i1"), Buffer.from("i2"), Buffer.from("i3")],
        imageSpecs: [],
        videoDelivered: true,
      }),
    );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    await service.processCreativeBrief(buildBrief({ formats: ["VIDEO_15S"], urgency: "HIGH" }));

    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({ aiModel: "veo3+google/nano-banana-pro" }),
    );
  });

  it("aiModel description is image-only when no video is delivered", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    await service.processCreativeBrief(buildBrief({ formats: ["IMAGE_SQUARE"] }));

    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({ aiModel: "google/nano-banana-pro" }),
    );
  });

  it("uses brief.id as correlationId when none is supplied", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    const brief = buildBrief();
    await service.processCreativeBrief(brief);

    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: brief.id.toString() }),
    );
  });

  it("passes the given correlationId through when supplied", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const { service } = buildService({ getAssetsByUnit, saveAiCreative, orchestrate });

    await service.processCreativeBrief(buildBrief(), "explicit-cid");

    expect(saveAiCreative.execute).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: "explicit-cid" }),
    );
  });

  it("copy generation failure -> propagates the error, never calls saveAiCreative", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = { execute: vi.fn() };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const failingCopyGenerationService = {
      generate: vi.fn().mockResolvedValue(errResult(new GenerationError("copy build failed"))),
    } as unknown as CopyGenerationService;
    const { service } = buildService({
      getAssetsByUnit,
      saveAiCreative,
      orchestrate,
      copyGenerationService: failingCopyGenerationService,
    });

    const error = unwrapErr(await service.processCreativeBrief(buildBrief()));
    expect(error.message).toBe("copy build failed");
    expect(saveAiCreative.execute).not.toHaveBeenCalled();
  });

  it("defaults `now` to the real wall clock when not supplied", async () => {
    const getAssetsByUnit = {
      execute: vi.fn().mockResolvedValue(okResult(buildAssetCollection([]))),
    };
    const saveAiCreative = {
      execute: vi.fn().mockResolvedValue(okResult(savedImagesOnlyAssets())),
    };
    const orchestrate = vi
      .fn()
      .mockResolvedValue(
        okResult({ imageBuffers: [Buffer.from("i1")], imageSpecs: [], videoDelivered: false }),
      );
    const publisher = new RecordingPublisher();
    const events = new CreativeAgentEvents(publisher);
    const jobRegistry = new GenerationJobRegistry();
    const orchestratorService = { orchestrate } as unknown as CreativeOrchestratorService;

    const service = new KaiAgentService(
      getAssetsByUnit,
      saveAiCreative,
      new FormatDecisionService(new FormatDecider()),
      new PromptBuildingService(new AutomotivePromptBuilder()),
      new CopyGenerationService(new CopyBuilder(), events),
      orchestratorService,
      events,
      jobRegistry,
      CONFIG,
    );

    const pkg = unwrap(await service.processCreativeBrief(buildBrief()));
    expect(pkg.status).toBe(GenerationStatus.READY);
  });
});
