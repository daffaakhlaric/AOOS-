import type { Result } from "@aos/common";

import type { GenerationError } from "../domain/errors/GenerationError.js";
import type { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import type { VideoSpec } from "../domain/value-objects/VideoSpec.js";

export interface OrchestrateGenerationInput {
  readonly sourcePhotoUrl?: string;
  readonly sourcePhotoFileName?: string;
  readonly sourcePhotoMimeType?: string;
  readonly videoPrompt?: string;
  readonly videoSpec?: VideoSpec;
  readonly imagePrompts: ReadonlyArray<string>;
  readonly imageSpec: ImageSpec;
  readonly correlationId?: string;
}

export interface OrchestrateGenerationOutput {
  readonly videoBuffer?: Buffer;
  readonly imageBuffers: ReadonlyArray<Buffer>;
  readonly imageSpecs: ReadonlyArray<ImageSpec>;
  readonly videoDelivered: boolean;
}

/** Port (Hexagonal Architecture) for Kai's Kie AI generation orchestration (spec "Full Pipeline: ProcessCreativeBrief" steps 4-6). The only implementation is `application/services/CreativeOrchestratorService.ts`, which calls `@aos/creative-connector` for real. */
export interface ICreativeOrchestrator {
  orchestrate(
    input: OrchestrateGenerationInput,
  ): Promise<Result<OrchestrateGenerationOutput, GenerationError>>;
}
