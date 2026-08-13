import type { Result } from "@aos/common";

import type {
  ICreativeClient,
  KieTaskCreatedResponse,
  NanoBananaProGeneratePayload,
  RawTaskStatusResponse,
  VeoExtendPayload,
  VeoGenerateFromImagePayload,
  VeoGenerateFromTextPayload,
} from "../../src/contracts/ICreativeClient.js";
import type { KieApiError } from "../../src/domain/errors/KieApiError.js";
import type { RateLimitError } from "../../src/domain/errors/RateLimitError.js";

export interface FakeCreativeClientOverrides {
  readonly generateVideoFromImage?: (
    payload: VeoGenerateFromImagePayload,
  ) => Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;
  readonly generateVideoFromText?: (
    payload: VeoGenerateFromTextPayload,
  ) => Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;
  readonly extendVideo?: (
    payload: VeoExtendPayload,
  ) => Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;
  readonly generateImage?: (
    payload: NanoBananaProGeneratePayload,
  ) => Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>>;
  readonly getTaskStatus?: (
    taskId: string,
  ) => Promise<Result<RawTaskStatusResponse, KieApiError | RateLimitError>>;
}

/** A fully-stubbed `ICreativeClient` test double — every method throws unless overridden, so a test failing to override a method it exercises fails loudly rather than silently returning `undefined`. */
export function fakeCreativeClient(overrides: FakeCreativeClientOverrides = {}): ICreativeClient {
  const notImplemented = (): never => {
    throw new Error("fakeCreativeClient: method not implemented in this test's overrides");
  };
  return {
    generateVideoFromImage: overrides.generateVideoFromImage ?? notImplemented,
    generateVideoFromText: overrides.generateVideoFromText ?? notImplemented,
    extendVideo: overrides.extendVideo ?? notImplemented,
    generateImage: overrides.generateImage ?? notImplemented,
    getTaskStatus: overrides.getTaskStatus ?? notImplemented,
  };
}
