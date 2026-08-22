import { type Result } from "@aos/common";

import {
  ApiServerError,
  type MetaGraphApiError,
  RateLimitError,
} from "../../domain/errors/index.js";

const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 500, 503]);
const NON_RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([400, 401, 403]);

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

export interface ExponentialBackoffRetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  /** Injected sleep function — defaults to a real `setTimeout`-based wait only when unset; tests inject a no-op/instant sleep so delay *values* are asserted without ever actually waiting. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/**
 * Determines whether a failure is retryable: retryable = {429, 500, 503, network errors};
 * not retryable = {400, 401, 403}. A `MetaGraphApiError` with no `httpStatus` at all (a
 * network/timeout failure — `ApiServerError` constructed without an HTTP response) is treated as
 * retryable. Any other, unlisted HTTP status defaults to non-retryable (fail closed). Mirrors
 * `@aos/meta-ads-connector`'s `isRetryable` exactly.
 */
export function isRetryable(error: MetaGraphApiError): boolean {
  if (error.httpStatus === undefined) {
    return error instanceof ApiServerError;
  }
  if (NON_RETRYABLE_HTTP_STATUSES.has(error.httpStatus)) {
    return false;
  }
  return RETRYABLE_HTTP_STATUSES.has(error.httpStatus);
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Wraps an async, `Result`-returning operation with exponential backoff: max 3 attempts, delays
 * 1s/2s/4s, retryable = {429, 500, 503, network errors}. On final failure, returns the last
 * `Result.err(MetaGraphApiError)` — never throws. Mirrors `@aos/meta-ads-connector`'s
 * `ExponentialBackoffRetry` exactly (same discipline, separate composition root).
 */
export class ExponentialBackoffRetry {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: ExponentialBackoffRetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.sleep = options.sleep ?? realSleep;
  }

  /** The delay before attempt `attemptNumber` (1-based), i.e. `baseDelayMs * 2^(attemptNumber - 1)`. */
  delayForAttempt(attemptNumber: number): number {
    return this.baseDelayMs * 2 ** (attemptNumber - 1);
  }

  async execute<T>(
    operation: () => Promise<Result<T, MetaGraphApiError>>,
  ): Promise<Result<T, MetaGraphApiError>> {
    let lastResult: Result<T, MetaGraphApiError> | undefined;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const result = await operation();
      lastResult = result;
      if (result.ok) {
        return result;
      }
      const canRetry = attempt < this.maxAttempts && isRetryable(result.error);
      if (!canRetry) {
        return result;
      }
      // A 429 (`RateLimitError`) honors Meta's own `Retry-After` (parsed into
      // `RateLimitError.retryAfterMs` by `MetaGraphApiClient.toMetaGraphApiError`, defaulting to
      // 60s when the header is absent) instead of the exponential schedule — avoids hammering an
      // already-rate-limited endpoint a second later.
      const delayMs =
        result.error instanceof RateLimitError
          ? result.error.retryAfterMs
          : this.delayForAttempt(attempt);
      await this.sleep(delayMs);
    }
    // Unreachable when maxAttempts >= 1 (the loop always assigns lastResult and returns before
    // falling through), but TypeScript can't prove that from the loop shape alone.
    return lastResult as Result<T, MetaGraphApiError>;
  }
}
