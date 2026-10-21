import { err, type Result } from "@aos/common";

import type {
  ICreativeClient,
  KieTaskCreatedResponse,
  NanoBananaProGeneratePayload,
  RawTaskStatusResponse,
  VeoExtendPayload,
  VeoGenerateFromImagePayload,
  VeoGenerateFromTextPayload,
} from "../../contracts/ICreativeClient.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import { RateLimitError } from "../../domain/errors/RateLimitError.js";
import { TokenBucketRateLimiter } from "../rate-limiter/TokenBucketRateLimiter.js";

import { KieApiResponseMapper } from "./KieApiResponseMapper.js";

/**
 * The `api.kie.ai` generation host and its endpoint paths — kept as named constants (not inline
 * string literals) so they are easy to find/change in one place, per design resolution #2's
 * requirement for the extend-endpoint choice specifically. `VEO_EXTEND_PATH` implements design
 * resolution #2: the spec offers two possible extend endpoints ("Veo extend endpoint" vs. "market
 * extend"); this package uses the Veo-specific one (`/api/v1/veo/extend`) exclusively, for
 * consistency with the rest of this package's video flow, which never touches the market-model
 * (`/api/v1/jobs/createTask`) path for video — only for images.
 */
export const KIE_GENERATION_BASE_URL = "https://api.kie.ai";
export const VEO_GENERATE_PATH = "/api/v1/veo/generate";
export const VEO_EXTEND_PATH = "/api/v1/veo/extend";
export const JOBS_CREATE_TASK_PATH = "/api/v1/jobs/createTask";

export function jobsStatusPath(taskId: string, kind: "image" | "video" = "image"): string {
  return `${kind === "video" ? "/api/v1/veo/record-info" : "/api/v1/jobs/recordInfo"}?taskId=${encodeURIComponent(taskId)}`;
}

const DEFAULT_MAX_ATTEMPTS = 4; // 1 initial attempt + up to 3 retries, per the spec's "max 3x"
const DEFAULT_RETRY_WAIT_MS = 10_000;

export interface KieAiGenerationClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  /** Injectable native `fetch` — overridable for tests (MSW normally suffices). */
  readonly fetchImpl?: typeof fetch;
  readonly rateLimiter?: TokenBucketRateLimiter;
  /** Injected sleep — defaults to a real `setTimeout`-based wait; tests inject an instant sleep so the 10s 429 backoff is asserted without ever actually waiting. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Total attempts (initial + retries) for a 429 response. Defaults to 4 (1 + 3 retries). */
  readonly maxAttempts?: number;
  readonly retryWaitMs?: number;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * `fetch`-based (no axios) implementation of `ICreativeClient`, talking to `https://api.kie.ai` —
 * Parts 2-5 of the spec. Enforces Kie AI's documented 20-requests/10-seconds limit proactively via
 * an injected `TokenBucketRateLimiter`, and reactively retries a real HTTP 429 up to 3 times with
 * a fixed 10s wait between attempts. A 401 (or any other non-429 failure) is never retried.
 */
export class KieAiGenerationClient implements ICreativeClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly retryWaitMs: number;

  constructor(options: KieAiGenerationClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? KIE_GENERATION_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.rateLimiter = options.rateLimiter ?? new TokenBucketRateLimiter();
    this.sleep = options.sleep ?? realSleep;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.retryWaitMs = options.retryWaitMs ?? DEFAULT_RETRY_WAIT_MS;
  }

  async generateVideoFromImage(
    payload: VeoGenerateFromImagePayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>> {
    return this.postJson(VEO_GENERATE_PATH, payload, KieApiResponseMapper.mapTaskCreatedResponse);
  }

  async generateVideoFromText(
    payload: VeoGenerateFromTextPayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>> {
    return this.postJson(VEO_GENERATE_PATH, payload, KieApiResponseMapper.mapTaskCreatedResponse);
  }

  async extendVideo(
    payload: VeoExtendPayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>> {
    return this.postJson(VEO_EXTEND_PATH, payload, KieApiResponseMapper.mapTaskCreatedResponse);
  }

  async generateImage(
    payload: NanoBananaProGeneratePayload,
  ): Promise<Result<KieTaskCreatedResponse, KieApiError | RateLimitError>> {
    return this.postJson(
      JOBS_CREATE_TASK_PATH,
      payload,
      KieApiResponseMapper.mapTaskCreatedResponse,
    );
  }

  async getTaskStatus(
    taskId: string,
    kind: "image" | "video" = "image",
  ): Promise<Result<RawTaskStatusResponse, KieApiError | RateLimitError>> {
    return this.request(
      "GET",
      jobsStatusPath(taskId, kind),
      undefined,
      KieApiResponseMapper.mapTaskStatusResponse,
    );
  }

  private async postJson<T>(
    path: string,
    body: unknown,
    mapper: (json: unknown) => Result<T, KieApiError>,
  ): Promise<Result<T, KieApiError | RateLimitError>> {
    return this.request("POST", path, body, mapper);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    mapper: (json: unknown) => Result<T, KieApiError>,
  ): Promise<Result<T, KieApiError | RateLimitError>> {
    let lastResult: Result<T, KieApiError | RateLimitError> | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const consumeResult = this.rateLimiter.tryConsume();
      if (!consumeResult.ok) {
        return err(consumeResult.error);
      }

      const result = await this.doFetch(method, path, body, mapper);
      lastResult = result;
      if (result.ok) {
        return result;
      }
      const canRetry = attempt < this.maxAttempts && result.error instanceof RateLimitError;
      if (!canRetry) {
        return result;
      }
      await this.sleep(this.retryWaitMs);
    }

    /* v8 ignore next 3 -- unreachable when maxAttempts >= 1 (the loop always assigns lastResult and returns before
       falling through), but TypeScript can't prove that from the loop shape alone. */
    return lastResult as Result<T, KieApiError | RateLimitError>;
  }

  private async doFetch<T>(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    mapper: (json: unknown) => Result<T, KieApiError>,
  ): Promise<Result<T, KieApiError | RateLimitError>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(45000),
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
        },
        ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      return err(
        new KieApiError(`KieAiGenerationClient: network failure calling ${method} ${path}`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      return err(
        new RateLimitError(`KieAiGenerationClient: ${path} responded with HTTP 429`, retryAfterMs),
      );
    }

    if (response.status === 401) {
      return err(
        new KieApiError(`KieAiGenerationClient: ${path} responded with HTTP 401 (unauthorized)`, {
          httpStatus: 401,
        }),
      );
    }

    if (!response.ok) {
      return err(
        new KieApiError(`KieAiGenerationClient: ${path} responded with HTTP ${response.status}`, {
          httpStatus: response.status,
        }),
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      return err(
        new KieApiError(`KieAiGenerationClient: ${path} response body was not valid JSON`, {
          cause: error instanceof Error ? error : undefined,
        }),
      );
    }

    return mapper(json);
  }
}

const DEFAULT_RETRY_AFTER_MS = 10_000;

function parseRetryAfterMs(headerValue: string | null): number {
  if (headerValue === null) {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return DEFAULT_RETRY_AFTER_MS;
}
