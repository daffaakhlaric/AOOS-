import type { IRetryPolicy, RetryMetadata } from "../contracts/retry-policy.js";
import { RetryExhaustedException } from "../errors/retry-exhausted-exception.js";

export interface RetryExecutorOptions {
  readonly policy: IRetryPolicy;
  /** Injectable so tests don't wait on real timers — defaults to a real `setTimeout`-backed sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Called after every failed attempt, including the final exhausted one — used by the Dispatcher for metrics/tracing/events. */
  readonly onAttemptFailed?: (metadata: RetryMetadata) => void;
}

export interface RetryOutcome<T> {
  readonly result: T;
  readonly metadata: RetryMetadata;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Executes an operation under a Retry Policy — Retry Count is `metadata.attempt`, Retry Metadata is returned/reported. */
export class RetryExecutor {
  constructor(private readonly options: RetryExecutorOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<RetryOutcome<T>> {
    const { policy, onAttemptFailed } = this.options;
    const sleep = this.options.sleep ?? defaultSleep;
    let lastError: unknown;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      try {
        const result = await operation();
        return { result, metadata: { attempt, maxAttempts: policy.maxAttempts } };
      } catch (error) {
        lastError = error;
        const metadata: RetryMetadata = {
          attempt,
          maxAttempts: policy.maxAttempts,
          lastError: error instanceof Error ? error.message : String(error),
        };
        onAttemptFailed?.(metadata);
        if (attempt < policy.maxAttempts) {
          await sleep(policy.nextDelayMs(attempt));
        }
      }
    }

    throw new RetryExhaustedException(
      `Operation failed after ${policy.maxAttempts} attempt(s): ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      { cause: lastError },
    );
  }
}
