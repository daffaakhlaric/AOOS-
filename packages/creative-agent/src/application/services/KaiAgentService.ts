import { AssetType } from "@aos/asset-library";
import { err, ok, type Result } from "@aos/common";
import type { CreativeBrief } from "@aos/meta-ads-agent";

import { CreativePackageBuilder } from "../../builders/CreativePackageBuilder.js";
import { GenerationJobBuilder } from "../../builders/GenerationJobBuilder.js";
import type { CreativeAgentConfig } from "../../config/CreativeAgentConfig.js";
import type { ICreativeAgent } from "../../contracts/ICreativeAgent.js";
import type { ICreativeAssetSaver } from "../../contracts/ICreativeAssetSaver.js";
import type { IPhotoSource } from "../../contracts/IPhotoSource.js";
import type { CreativePackage } from "../../domain/entities/CreativePackage.js";
import type { GenerationJob } from "../../domain/entities/GenerationJob.js";
import type { CreativeAgentError } from "../../domain/errors/CreativeAgentError.js";
import { GenerationError } from "../../domain/errors/GenerationError.js";
import { NoSourcePhotosError } from "../../domain/errors/NoSourcePhotosError.js";
import type { CreativeAgentEvents } from "../../domain/events/CreativeAgentEvents.js";
import { ConfidenceScore } from "../../domain/value-objects/ConfidenceScore.js";
import { CreativeFormat } from "../../domain/value-objects/CreativeFormat.js";
import { GenerationStatus } from "../../domain/value-objects/GenerationStatus.js";
import type { GenerationJobRegistry } from "../../registry/GenerationJobRegistry.js";

import type { CopyGenerationService } from "./CopyGenerationService.js";
import type { CreativeOrchestratorService } from "./CreativeOrchestratorService.js";
import type { FormatDecisionService } from "./FormatDecisionService.js";
import type { PromptBuildingService } from "./PromptBuildingService.js";

/**
 * Orchestrates Kai's full creative pipeline (spec "application/services/KaiAgentService.ts" —
 * "orchestrate full creative pipeline"), implementing every step of "Full Pipeline:
 * ProcessCreativeBrief": query photos -> decide format -> build prompts -> generate via
 * `@aos/creative-connector` -> persist to `@aos/asset-library` -> build the `CreativePackage` ->
 * emit `CreativePackageReady`.
 */
export class KaiAgentService implements ICreativeAgent {
  constructor(
    private readonly getAssetsByUnit: IPhotoSource,
    private readonly saveAiCreative: ICreativeAssetSaver,
    private readonly formatDecisionService: FormatDecisionService,
    private readonly promptBuildingService: PromptBuildingService,
    private readonly copyGenerationService: CopyGenerationService,
    private readonly orchestratorService: CreativeOrchestratorService,
    private readonly events: CreativeAgentEvents,
    private readonly jobRegistry: GenerationJobRegistry,
    private readonly config: CreativeAgentConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async processCreativeBrief(
    brief: CreativeBrief,
    correlationId?: string,
  ): Promise<Result<CreativePackage, CreativeAgentError>> {
    const startedAt = this.now();
    const cid = correlationId ?? brief.id.toString();
    let job = GenerationJobBuilder.pending(brief, startedAt);
    this.jobRegistry.upsert(job);

    // Step 1-2: query @aos/asset-library for source photos of the unit.
    const photosResult = await this.getAssetsByUnit.execute({ unitId: brief.unit });
    if (!photosResult.ok) {
      const error = new NoSourcePhotosError(
        `Kai: failed to query source photos for unit "${brief.unit}": ${photosResult.error.message}`,
        { cause: photosResult.error },
      );
      return this.fail(job, brief, cid, error);
    }
    const photos = photosResult.value;
    const availablePhotos = photos.count;

    // Step 3: decide format.
    const decision = this.formatDecisionService.decide(brief, availablePhotos);
    job = job.withFormat(decision.format);
    job = job.withStatus(GenerationStatus.GENERATING);
    this.jobRegistry.upsert(job);

    await this.events.publishCreativeGenerationStarted({
      jobId: job.id.toString(),
      briefId: brief.id.toString(),
      branch: brief.branch,
      unit: brief.unit,
      format: decision.format,
      tenantId: this.config.tenantId,
      correlationId: cid,
      occurredAt: this.now(),
      version: "1.0",
    });

    // Step 4a: build prompts.
    const topPhoto = availablePhotos >= 1 ? photos.assets[0] : undefined;
    const needsVideo = decision.format === CreativeFormat.VIDEO_AND_IMAGES;
    const prompts = this.promptBuildingService.build(brief, needsVideo, topPhoto !== undefined);

    // Step 4b-6: orchestrate generation via @aos/creative-connector, then download results.
    const orchestrationResult = await this.orchestratorService.orchestrate({
      sourcePhotoUrl: topPhoto?.publicUrl.toString(),
      sourcePhotoFileName: topPhoto?.fileName,
      sourcePhotoMimeType: topPhoto?.mimeType.toString(),
      videoPrompt: prompts.videoPrompt,
      videoSpec: decision.videoSpec,
      imagePrompts: prompts.imagePrompts,
      imageSpec: decision.imageSpec,
      correlationId: cid,
    });
    if (!orchestrationResult.ok) {
      return this.fail(job, brief, cid, orchestrationResult.error);
    }
    const generated = orchestrationResult.value;

    // Step 4c: build copy variants.
    const copyResult = await this.copyGenerationService.generate(brief, this.config.tenantId, cid);
    if (!copyResult.ok) {
      return this.fail(job, brief, cid, copyResult.error);
    }

    // Step 6: upload generated assets back to @aos/asset-library.
    const saveResult = await this.saveAiCreative.execute({
      videoBuffer: generated.videoBuffer,
      imageBuffers: [...generated.imageBuffers],
      creativeBriefId: brief.id.toString(),
      unitId: brief.unit,
      branch: brief.branch,
      aiPrompt: prompts.videoPrompt ?? prompts.imagePrompts[0] ?? brief.primaryMessage,
      aiModel: this.describeModel(decision, generated.videoDelivered),
      tenantId: this.config.tenantId,
      correlationId: cid,
    });
    if (!saveResult.ok) {
      const error = new GenerationError(
        `Kai: failed to persist generated creative to asset-library: ${saveResult.error.message}`,
        { cause: saveResult.error },
      );
      return this.fail(job, brief, cid, error);
    }

    const savedAssets = saveResult.value.assets;
    const imageUrls = savedAssets
      .filter((asset) => asset.type === AssetType.AI_IMAGE)
      .map((asset) => asset.publicUrl.toString());
    const videoAsset = savedAssets.find((asset) => asset.type === AssetType.AI_VIDEO);
    const videoUrl = videoAsset?.publicUrl.toString();

    const completedAt = this.now();
    const confidenceScore = ConfidenceScore.compute({
      imageUrlCount: imageUrls.length,
      requestedImageCount: decision.imageSpec.count,
      videoRequested: needsVideo,
      videoDelivered: videoUrl !== undefined,
    });

    const packageResult = CreativePackageBuilder.build({
      briefId: brief.id,
      branch: brief.branch,
      unit: brief.unit,
      status: GenerationStatus.READY,
      videoUrl,
      videoSpec: videoUrl !== undefined ? decision.videoSpec : undefined,
      imageUrls,
      imageSpecs: imageUrls.map(() => decision.imageSpec),
      copyVariants: copyResult.value,
      generatedAt: completedAt,
      totalGenerationMs: completedAt.getTime() - startedAt.getTime(),
      confidenceScore,
    });
    /* v8 ignore next 3 -- unreachable: every field passed to `CreativePackageBuilder.build` above is either sourced from an already-validated `brief`/`decision`, or Zod-validated `saveResult` output, so `CreativePackage.create`'s failure modes can never trigger here. */
    if (!packageResult.ok) {
      return this.fail(job, brief, cid, new GenerationError(packageResult.error.message));
    }
    const pkg = packageResult.value;

    this.jobRegistry.upsert(job.withReady(pkg.id, completedAt));

    await this.events.publishCreativePackageReady({
      packageId: pkg.id.toString(),
      briefId: brief.id.toString(),
      branch: brief.branch,
      unit: brief.unit,
      videoUrl,
      imageUrls,
      copyVariantCount: pkg.copyVariants.length,
      confidenceScore: confidenceScore.toNumber(),
      tenantId: this.config.tenantId,
      correlationId: cid,
      occurredAt: completedAt,
      version: "1.0",
    });

    return ok(pkg);
  }

  private describeModel(
    decision: ReturnType<FormatDecisionService["decide"]>,
    videoDelivered: boolean,
  ): string {
    const imageModel: string = decision.imageSpec.model;
    if (videoDelivered && decision.videoSpec !== undefined) {
      const videoModel: string = decision.videoSpec.model;
      return `${videoModel}+${imageModel}`;
    }
    return imageModel;
  }

  private async fail(
    job: GenerationJob,
    brief: CreativeBrief,
    correlationId: string,
    error: CreativeAgentError,
  ): Promise<Result<CreativePackage, CreativeAgentError>> {
    const failedAt = this.now();
    this.jobRegistry.upsert(job.withFailure(error.message, failedAt));

    await this.events.publishCreativeGenerationFailed({
      briefId: brief.id.toString(),
      jobId: job.id.toString(),
      branch: brief.branch,
      unit: brief.unit,
      reason: error.message,
      tenantId: this.config.tenantId,
      correlationId,
      occurredAt: failedAt,
      version: "1.0",
    });

    return err(error);
  }
}
