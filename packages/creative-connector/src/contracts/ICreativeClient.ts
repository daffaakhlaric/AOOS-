import type { Result } from "@aos/common";

import type { KieApiError } from "../domain/errors/KieApiError.js";
import type { RateLimitError } from "../domain/errors/RateLimitError.js";

export interface KieTaskCreatedResponse {
  readonly taskId: string;
}

/** Raw shape of a `GET /api/v1/jobs/{taskId}` poll response body (Part 4 of the spec), pre-mapping. */
export interface RawTaskStatusResponse {
  readonly taskId: string;
  readonly successFlag: number;
  readonly videoUrl?: string;
  readonly imageUrl?: string;
  readonly images?: readonly string[];
}

export interface VeoGenerateFromImagePayload {
  readonly prompt: string;
  readonly imageUrls: readonly string[];
  readonly model: string;
  readonly aspect_ratio: string;
  readonly watermark: string;
  readonly callBackUrl?: string;
  readonly enableFallback: boolean;
  readonly enableTranslation: boolean;
  readonly generationType: "REFERENCE_2_VIDEO";
}

export interface VeoGenerateFromTextPayload {
  readonly prompt: string;
  readonly model: string;
  readonly aspect_ratio: string;
  readonly generationType: "TEXT_2_VIDEO";
  readonly callBackUrl?: string;
}

export interface NanoBananaProGeneratePayload {
  readonly model: string;
  readonly callBackUrl?: string;
  readonly input: {
    readonly prompt: string;
    readonly image_url?: string;
    readonly output_format: string;
    readonly aspect_ratio: string;
  };
}

export interface VeoExtendPayload {
  readonly taskId: string;
  readonly duration: number;
}

/**
 * Port (Hexagonal Architecture) for the low-level `api.kie.ai` HTTP surface — task creation
 * (video/image/extend) and status polling. The only implementation is
 * `infrastructure/kie-api/KieAiGenerationClient.ts`. Distinct from `IVideoGenerator`/
 * `IImageGenerator`/`ITaskPoller`, which are the higher-level, domain-typed ports the application
 * layer's services depend on — those wrap this raw client.
 */
export interface ICreativeClient {
  generateVideoFromImage(
    payload: VeoGenerateFromImagePayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;

  generateVideoFromText(
    payload: VeoGenerateFromTextPayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;

  extendVideo(
    payload: VeoExtendPayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;

  generateImage(
    payload: NanoBananaProGeneratePayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;

  getTaskStatus(
    taskId: string,
  ): Promise<Result<RawTaskStatusResponse, KieApiError | RateLimitError>>;
}
