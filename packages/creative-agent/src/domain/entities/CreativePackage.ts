import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";
import type { CreativeBriefId } from "@aos/meta-ads-agent";
import type { Branch } from "@aos/meta-ads-connector";

import type { ConfidenceScore } from "../value-objects/ConfidenceScore.js";
import type { GenerationStatus } from "../value-objects/GenerationStatus.js";
import type { ImageSpec } from "../value-objects/ImageSpec.js";
import type { PackageId } from "../value-objects/PackageId.js";
import type { VideoSpec } from "../value-objects/VideoSpec.js";

import type { CopyVariant } from "./CopyVariant.js";

export interface CreativePackageProps {
  readonly id: PackageId;
  readonly briefId: CreativeBriefId;
  readonly branch: Branch;
  readonly unit: string;
  readonly status: GenerationStatus;
  readonly videoUrl?: string;
  readonly videoSpec?: VideoSpec;
  readonly imageUrls: ReadonlyArray<string>;
  readonly imageSpecs: ReadonlyArray<ImageSpec>;
  readonly copyVariants: ReadonlyArray<CopyVariant>;
  readonly generatedAt?: Date;
  readonly totalGenerationMs?: number;
  readonly confidenceScore: ConfidenceScore;
  /**
   * REAL BUG FIX diagnostic field: set only when `CreativeOrchestratorService` had a real source
   * photo (a real `assets` row, a genuinely-fetched URL) but it could not be gotten to Kie AI —
   * e.g. a failed fetch/upload — so this package silently generated TEXT_2_VIDEO/text-to-image
   * instead of using the real unit photo. `undefined` whenever a photo either wasn't available at
   * all (nothing to report) or was successfully delivered. See
   * `ICreativeOrchestrator.OrchestrateGenerationOutput.sourcePhotoSkippedReason`'s docstring.
   */
  readonly sourcePhotoSkippedReason?: string;
}

/**
 * Kai's final output (spec "Domain Models → CreativePackage") — video URL + image URLs + copy
 * variants, ready for DSS Motor to review and approve. Immutable read model; every field is
 * populated once by `CreativePackageBuilder` at the end of `KaiAgentService.processCreativeBrief`.
 */
export class CreativePackage {
  private constructor(private readonly props: CreativePackageProps) {}

  static create(props: CreativePackageProps): Result<CreativePackage, ValidationError> {
    if (props.unit.trim().length === 0) {
      return err(new ValidationError("CreativePackage.unit must be a non-empty string"));
    }
    if (
      props.videoUrl !== undefined &&
      (typeof props.videoUrl !== "string" || props.videoUrl.trim().length === 0)
    ) {
      return err(
        new ValidationError("CreativePackage.videoUrl must be a non-empty string when provided"),
      );
    }
    if (props.imageUrls.length !== props.imageSpecs.length) {
      return err(
        new ValidationError(
          `CreativePackage.imageUrls (${props.imageUrls.length}) and imageSpecs (${props.imageSpecs.length}) must be the same length`,
        ),
      );
    }
    return ok(
      new CreativePackage({
        ...props,
        imageUrls: [...props.imageUrls],
        imageSpecs: [...props.imageSpecs],
        copyVariants: [...props.copyVariants],
      }),
    );
  }

  get id(): PackageId {
    return this.props.id;
  }

  get briefId(): CreativeBriefId {
    return this.props.briefId;
  }

  get branch(): Branch {
    return this.props.branch;
  }

  get unit(): string {
    return this.props.unit;
  }

  get status(): GenerationStatus {
    return this.props.status;
  }

  get videoUrl(): string | undefined {
    return this.props.videoUrl;
  }

  get videoSpec(): VideoSpec | undefined {
    return this.props.videoSpec;
  }

  get imageUrls(): ReadonlyArray<string> {
    return this.props.imageUrls;
  }

  get imageSpecs(): ReadonlyArray<ImageSpec> {
    return this.props.imageSpecs;
  }

  get copyVariants(): ReadonlyArray<CopyVariant> {
    return this.props.copyVariants;
  }

  get generatedAt(): Date | undefined {
    return this.props.generatedAt;
  }

  get totalGenerationMs(): number | undefined {
    return this.props.totalGenerationMs;
  }

  get confidenceScore(): ConfidenceScore {
    return this.props.confidenceScore;
  }

  get sourcePhotoSkippedReason(): string | undefined {
    return this.props.sourcePhotoSkippedReason;
  }
}
