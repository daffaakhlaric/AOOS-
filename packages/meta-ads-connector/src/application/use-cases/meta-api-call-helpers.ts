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

/**
 * N+1-fanout fix's real, honest pagination-overflow (and "not present at all") handling.
 * `PullCampaignData`'s new field-expansion pull (`getCampaignsExpanded`) inlines each campaign's
 * `adsets` (and each adset's `ads`) as a nested edge — but that nested edge is only ONE page
 * (`.limit(N)`, see `MetaApiRequestBuilder`'s docstring), so a campaign/adset whose real child
 * count exceeds `N` would silently lose data if the nested page were trusted blindly. This helper
 * is the single, shared decision point: use the nested page as-is when it's genuinely the WHOLE
 * list (no `paging.next`); otherwise (a real overflow, OR the nested edge being absent entirely —
 * e.g. an older/differently-shaped mocked response in a test) fall back to `fetchFn`, which the
 * caller wires to the pre-existing, already-correct, fully-paginated dedicated edge call
 * (`getAdSets`/`getAds`) for that ONE campaign/adset — so the fallback fanout, when it does
 * happen, is scoped to the rare overflowing branch, never the whole tree.
 */
export async function extractOrFetch<T>(
  nested: { readonly data: ReadonlyArray<T>; readonly paging?: MetaPaging } | undefined,
  fetchFn: () => Promise<Result<T[], MetaApiError>>,
): Promise<Result<T[], MetaApiError>> {
  if (nested !== undefined && nested.paging?.next === undefined) {
    return ok([...nested.data]);
  }
  return fetchFn();
}
