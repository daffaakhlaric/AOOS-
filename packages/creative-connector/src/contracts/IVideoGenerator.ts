import type { Result } from "@aos/common";

import type { GenerationTask } from "../domain/entities/GenerationTask.js";
import type { KieApiError } from "../domain/errors/KieApiError.js";
import type { RateLimitError } from "../domain/errors/RateLimitError.js";
import type { AspectRatio } from "../domain/value-objects/AspectRatio.js";
import type { TaskId } from "../domain/value-objects/TaskId.js";
import type { VideoModel } from "../domain/value-objects/VideoModel.js";

export interface GenerateVideoFromImageParams {
  /** Up to 2 real reference photos — the real `POST /api/v1/veo/generate` `imageUrls` array field. */
  readonly sourceImageUrls: readonly string[];
  readonly prompt: string;
  readonly model: VideoModel;
  readonly aspectRatio: AspectRatio;
  readonly callbackUrl?: string;
}

export interface GenerateVideoFromTextParams {
  readonly prompt: string;
  readonly model: VideoModel;
  readonly aspectRatio: AspectRatio;
  readonly callbackUrl?: string;
}

export interface ExtendVideoParams {
  readonly taskId: TaskId;
  readonly additionalSeconds: number;
}

/** Port (Strategy Pattern: image-to-video vs. text-to-video vs. extend) implemented by `application/services/VideoGenerationService.ts`. */
export interface IVideoGenerator {
  generateFromImage(
    params: GenerateVideoFromImageParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>>;

  generateFromText(
    params: GenerateVideoFromTextParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>>;

  extendVideo(
    params: ExtendVideoParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>>;
}
