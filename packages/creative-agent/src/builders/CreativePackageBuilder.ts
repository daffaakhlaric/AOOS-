import type { Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";
import type { CreativeBriefId } from "@aos/meta-ads-agent";
import type { Branch } from "@aos/meta-ads-connector";

import type { CopyVariant } from "../domain/entities/CopyVariant.js";
import { CreativePackage } from "../domain/entities/CreativePackage.js";
import type { ConfidenceScore } from "../domain/value-objects/ConfidenceScore.js";
import type { GenerationStatus } from "../domain/value-objects/GenerationStatus.js";
import type { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import { PackageId } from "../domain/value-objects/PackageId.js";
import type { VideoSpec } from "../domain/value-objects/VideoSpec.js";

export interface CreativePackageBuilderInput {
  readonly briefId: CreativeBriefId;
  readonly branch: Branch;
  readonly unit: string;
  readonly status: GenerationStatus;
  readonly videoUrl?: string;
  readonly videoSpec?: VideoSpec;
  readonly imageUrls: ReadonlyArray<string>;
  readonly imageSpecs: ReadonlyArray<ImageSpec>;
  readonly copyVariants: ReadonlyArray<CopyVariant>;
  readonly generatedAt: Date;
  readonly totalGenerationMs: number;
  readonly confidenceScore: ConfidenceScore;
  readonly sourcePhotoSkippedReason?: string;
}

/** Builder Pattern (spec "builders/CreativePackageBuilder.ts") — the single place a `CreativePackage` gets assembled at the end of `KaiAgentService.processCreativeBrief`, generating its `PackageId` and delegating validation to `CreativePackage.create`. */
export class CreativePackageBuilder {
  static build(input: CreativePackageBuilderInput): Result<CreativePackage, ValidationError> {
    return CreativePackage.create({
      id: PackageId.generate(),
      briefId: input.briefId,
      branch: input.branch,
      unit: input.unit,
      status: input.status,
      videoUrl: input.videoUrl,
      videoSpec: input.videoSpec,
      imageUrls: input.imageUrls,
      imageSpecs: input.imageSpecs,
      copyVariants: input.copyVariants,
      generatedAt: input.generatedAt,
      totalGenerationMs: input.totalGenerationMs,
      confidenceScore: input.confidenceScore,
      sourcePhotoSkippedReason: input.sourcePhotoSkippedReason,
    });
  }
}
