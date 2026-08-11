import { err, ok, type Result } from "@aos/common";

import type { PageCursor } from "../../contracts/IMetaAdsClient.js";
import type { IRateLimiter } from "../../contracts/IRateLimiter.js";
import { type MetaApiError, RateLimitError } from "../../domain/errors/index.js";
import type { ExponentialBackoffRetry } from "../../infrastructure/retry/ExponentialBackoffRetry.js";
import type { MetaPaging } from "../../types/MetaApiTypes.js";

/**
 * Composes the local `TokenBucketRateLimiter` with `ExponentialBackoffRetry` around a single
 * Meta API call: consumes one local token before calling (failing fast with `Result.err` if the
 * local 200/hour budget is already exhausted, without ever hitting the network), retries per
 * `ExponentialBackoffRetry`'s policy, and — if Meta itself returns a 429 — feeds its
 * `retryAfterMs` back into the rate limiter via `notifyRateLimited` so local accounting stays in
 * sync with Meta's own throttling state.
 */
export async function callMetaApi<T>(
  rateLimiter: IRateLimiter,
  retry: ExponentialBackoffRetry,
  operation: () => Promise<Result<T, MetaApiError>>,
): Promise<Result<T, MetaApiError>> {
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

/** Follows Meta's cursor-based `paging.next`/`paging.cursors.after` pagination, accumulating every page's `data[]` into one array. */
export async function fetchAllPages<T>(
  fetchPage: (
    cursor?: PageCursor,
  ) => Promise<Result<{ data: ReadonlyArray<T>; paging?: MetaPaging }, MetaApiError>>,
): Promise<Result<T[], MetaApiError>> {
  const all: T[] = [];
  let cursor: PageCursor | undefined;
  for (;;) {
    const pageResult = await fetchPage(cursor);
    if (!pageResult.ok) {
      return pageResult;
    }
    all.push(...pageResult.value.data);
    const after = pageResult.value.paging?.cursors?.after;
    const next = pageResult.value.paging?.next;
    if (after === undefined || next === undefined) {
      break;
    }
    cursor = { after };
  }
  return ok(all);
}
