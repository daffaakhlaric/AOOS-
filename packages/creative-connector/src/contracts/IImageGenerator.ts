import type { Result } from "@aos/common";

import type { GenerationTask } from "../domain/entities/GenerationTask.js";
import type { KieApiError } from "../domain/errors/KieApiError.js";
import type { RateLimitError } from "../domain/errors/RateLimitError.js";
import type { AspectRatio } from "../domain/value-objects/AspectRatio.js";

export interface GenerateImageParams {
  readonly sourceImageUrl?: string;
  readonly prompt: string;
  readonly aspectRatio: AspectRatio;
  readonly outputFormat?: "jpg" | "png";
  readonly callbackUrl?: string;
}

/** Port implemented by `application/services/ImageGenerationService.ts` — Nano Banana Pro image-to-image generation. */
export interface IImageGenerator {
  generate(
    params: GenerateImageParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>>;
}
