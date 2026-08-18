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
   * REAL BUG FIX: previously, a real source photo (a genuine `assets` row, a genuinely
   * publicly-fetchable GCS URL) could silently fail to reach Kie AI — a network hiccup fetching
   * it, or a failed upload to Kie AI's own file host — and the whole generation would silently
   * fall back to TEXT_2_VIDEO/text-to-image with zero trace of why. `undefined` when a source
   * photo genuinely was delivered (or `input.sourcePhotoUrl` was never provided at all — the
   * ordinary "no scraped photos for this unit" case, also not an error). Set only when a REAL
   * photo existed but couldn't be gotten to Kie AI.
   */
  readonly sourcePhotoSkippedReason?: string;
}

/** Port (Hexagonal Architecture) for Kai's Kie AI generation orchestration (spec "Full Pipeline: ProcessCreativeBrief" steps 4-6). The only implementation is `application/services/CreativeOrchestratorService.ts`, which calls `@aos/creative-connector` for real. */
export interface ICreativeOrchestrator {
  orchestrate(
    input: OrchestrateGenerationInput,
  ): Promise<Result<OrchestrateGenerationOutput, GenerationError>>;
}
