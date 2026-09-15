import type { Result } from "@aos/common";

import type { GenerationError } from "../domain/errors/GenerationError.js";
import type { ImageSpec } from "../domain/value-objects/ImageSpec.js";
import type { VideoSpec } from "../domain/value-objects/VideoSpec.js";

export interface OrchestrateGenerationInput {
  /**
   * Up to 2 real scraped unit photos (the real Kie AI limit — confirmed live, 2026-08-18) —
   * `KaiAgentService` picks the top N `@aos/asset-library` assets for this unit, in the same
   * order as `sourcePhotoFileNames`/`sourcePhotoMimeTypes` below.
   */
  readonly sourcePhotoUrls?: readonly string[];
  readonly sourcePhotoFileNames?: readonly string[];
  readonly sourcePhotoMimeTypes?: readonly string[];
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
  /**
   * REAL BUG FIX (live-confirmed, 2026-09-15): `CreativeOrchestratorService` no longer re-uploads
   * source photos to Kie AI's own file host before generation (see that class's own doc for why —
   * two real, compounding bugs on that path, both now fixed at their own root, but the upload hop
   * itself turned out to be unnecessary: Kie AI's generation endpoints accept this codebase's own
   * already-public source photo URLs directly). This field is kept only because `KaiAgentService`
   * (the AUTOMOTIVE-vertical pipeline) and `CreativePackageBuilder` still have a real,
   * independent `sourcePhotoSkippedReason` concept on `CreativePackage` itself — removing this
   * field would force touching that unrelated pipeline for no benefit. Always `undefined` now.
   */
  readonly sourcePhotoSkippedReason?: string;
}

/** Port (Hexagonal Architecture) for Kai's Kie AI generation orchestration (spec "Full Pipeline: ProcessCreativeBrief" steps 4-6). The only implementation is `application/services/CreativeOrchestratorService.ts`, which calls `@aos/creative-connector` for real. */
export interface ICreativeOrchestrator {
  orchestrate(
    input: OrchestrateGenerationInput,
  ): Promise<Result<OrchestrateGenerationOutput, GenerationError>>;
}
