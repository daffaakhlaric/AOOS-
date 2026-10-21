import type { Result } from "@aos/common";

import type { KieApiError } from "../domain/errors/KieApiError.js";
import type { RateLimitError } from "../domain/errors/RateLimitError.js";

export interface KieTaskCreatedResponse {
  readonly taskId: string;
}

/** Normalized status shared by Market image and Veo video polling. */
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
    /**
     * REAL BUG FIX (live-confirmed, 2026-09-15 — corrects the earlier 2026-08-18 "confirmed live"
     * note below, which was a false positive): the earlier note took a real `taskId`/200 response
     * as proof `image_urls` was the right field name, but Kie AI's `createTask` endpoint accepts
     * (and silently ignores) unrecognized JSON fields — a 200 with a real taskId only proves the
     * REQUEST SHAPE was accepted, not that the reference image was actually used. The real field
     * name, confirmed directly against Kie AI's own example request for this exact model, is
     * `image_input` (singular key, plural array value) — every real generation using `image_urls`
     * was silently falling back to text-only generation from the prompt alone, exactly matching
     * the live-reported symptom ("dikirim referensi tapi hasilnya nggak berkaitan sama sekali").
     */
    readonly image_input?: readonly string[];
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
    kind?: "image" | "video",
  ): Promise<Result<RawTaskStatusResponse, KieApiError | RateLimitError>>;
}
