/** Awaitable delay. Generic infra utility — not the Tool Contract's retry/backoff policy engine. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly backoff?: "fixed" | "exponential";
}

/**
 * Generic retry-with-backoff helper for transient failures. This is a low-level primitive —
 * the Tool Contract's own `retry_policy` field (docs/003.5-CONTRACT-FIRST-DESIGN.md §3) governs
 * business-level Tool invocation retries; this helper is what such a policy would be implemented
 * on top of, once a Runtime exists.
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, baseDelayMs, backoff = "exponential" } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        break;
      }
      const delay = backoff === "exponential" ? baseDelayMs * 2 ** (attempt - 1) : baseDelayMs;
      await sleep(delay);
    }
  }

  throw lastError;
}
