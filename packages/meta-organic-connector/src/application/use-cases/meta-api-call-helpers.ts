import { err, type Result } from "@aos/common";

import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import { type MetaGraphApiError, RateLimitError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";

/**
 * Composes the local `TokenBucketRateLimiter` with `ExponentialBackoffRetry` around a single Meta
 * Graph API call: consumes one local token before calling (failing fast with `Result.err` if the
 * local budget is already exhausted, without ever hitting the network), retries per
 * `ExponentialBackoffRetry`'s policy, and — if Meta itself returns a 429 — feeds its
 * `retryAfterMs` back into the rate limiter via `notifyRateLimited` so local accounting stays in
 * sync with Meta's own throttling state. Mirrors `@aos/meta-ads-connector`'s `callMetaApi` exactly.
 */
export async function callMetaOrganicApi<T>(
  rateLimiter: IRateLimiter,
  retry: ExponentialBackoffRetry,
  operation: () => Promise<Result<T, MetaGraphApiError>>,
): Promise<Result<T, MetaGraphApiError>> {
  const consumeResult = rateLimiter.tryConsume();
  if (!consumeResult.ok) {
    return err(consumeResult.error);
  }

  const result = await retry.execute(operation);
  if (!result.ok && result.error instanceof RateLimitError) {
    rateLimiter.notifyRateLimited(result.error.retryAfterMs);
  }
  return result;
}
