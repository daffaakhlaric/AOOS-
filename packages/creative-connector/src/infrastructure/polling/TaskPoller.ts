import { err, ok, type Result } from "@aos/common";

import type { ICreativeClient, RawTaskStatusResponse } from "../../contracts/ICreativeClient.js";
import type { CompletedTask, ITaskPoller } from "../../contracts/ITaskPoller.js";
import { GenerationFailedError } from "../../domain/errors/GenerationFailedError.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import { TaskTimeoutError } from "../../domain/errors/TaskTimeoutError.js";
import { MediaUrl } from "../../domain/value-objects/MediaUrl.js";
import { SuccessFlag, parseSuccessFlag } from "../../domain/value-objects/SuccessFlag.js";
import type { TaskId } from "../../domain/value-objects/TaskId.js";

/** Poll backoff schedule (Part "Task Polling Service" of the spec): 5s → 10s → 15s → 20s → 30s, then holds at 30s. */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [5_000, 10_000, 15_000, 20_000, 30_000];
export const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * REAL BUG FIX (live-confirmed: 3 parallel image generations all failed with
 * `KieAiGenerationClient: /api/v1/jobs/<taskId> responded with HTTP 404` immediately after a
 * successful `createTask` call, different task ids each time — a systemic pattern, not a bad id).
 * `pollUntilComplete`'s very first status check fires with ZERO delay after task creation (no
 * sleep before the loop's first `getTaskStatus` call) — a brand-new task can genuinely not be
 * indexed yet on Kie AI's own status-lookup endpoint that fast, which their API surfaces as a real
 * HTTP 404, indistinguishable at the transport level from "this task id never existed". Without
 * this tolerance window, EVERY generation would need to race Kie AI's own indexing latency and can
 * lose. A 404 in this specific, narrow window is therefore treated the same as `successFlag=0`
 * (PENDING) — keep polling with the same backoff schedule — rather than an immediate hard
 * failure. Time-bounded, not indefinite: `NOT_YET_INDEXED_GRACE_MS` caps how long a 404 is given
 * this benefit of the doubt; past that, a persistent 404 means the task genuinely doesn't exist
 * (wrong id, or Kie AI purged it) and correctly surfaces as a real `KieApiError`, matching every
 * pre-existing test's "propagates a getTaskStatus error" expectation for a non-404 failure.
 */
export const NOT_YET_INDEXED_GRACE_MS = 30_000;

export interface TaskPollerOptions {
  /** Injected sleep — defaults to a real `setTimeout`-based wait; tests inject an instant sleep. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Injectable clock — defaults to the real wall clock; tests inject a stepped fake clock to deterministically exercise the timeout path without real waiting. */
  readonly now?: () => Date;
  /** Default `timeoutMs` used when `pollUntilComplete()` is called without one — e.g. wired from `CreativeConnectorConfig.maxPollDurationMs` by the factory. Defaults to `DEFAULT_TIMEOUT_MS`. */
  readonly defaultTimeoutMs?: number;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Implements the poll strategy of `ITaskPoller` (Strategy Pattern: poll vs. callback — this
 * package only implements poll). Calls `ICreativeClient.getTaskStatus` in a loop, per Part 4's
 * `successFlag` semantics: `0` → keep polling (with backoff), `1` → success, `2`/`3` → both
 * collapse to `GenerationFailedError` (design resolution #4). Returns `TaskTimeoutError` once
 * `timeoutMs` (default 300_000 / 5 minutes) elapses without a terminal `successFlag`.
 */
export class TaskPoller implements ITaskPoller {
  private readonly client: ICreativeClient;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly defaultTimeoutMs: number;

  constructor(client: ICreativeClient, options: TaskPollerOptions = {}) {
    this.client = client;
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? ((): Date => new Date());
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async pollUntilComplete(
    taskId: TaskId,
    kind: "video" | "image",
    timeoutMs?: number,
  ): Promise<
    Result<CompletedTask, TaskTimeoutError | GenerationFailedError | KieApiError | RateLimitError>
  > {
    const effectiveTimeoutMs = timeoutMs ?? this.defaultTimeoutMs;
    const startedAt = this.now();
    let backoffIndex = 0;

    for (;;) {
      const statusResult = await this.client.getTaskStatus(taskId.toString());
      const elapsedMs = this.now().getTime() - startedAt.getTime();

      if (!statusResult.ok) {
        // See NOT_YET_INDEXED_GRACE_MS's own doc — a 404 this early is Kie AI's own indexing
        // latency, not a genuinely nonexistent task; only within the grace window is it treated
        // as "keep polling" (falls through to the shared backoff/timeout logic below). Any other
        // failure (network error, 401, 500, or a 404 that has persisted past the grace window)
        // still propagates immediately, unchanged from the pre-existing behavior.
        const isNotYetIndexed =
          statusResult.error instanceof KieApiError &&
          statusResult.error.httpStatus === 404 &&
          elapsedMs < NOT_YET_INDEXED_GRACE_MS;
        if (!isNotYetIndexed) {
          return statusResult;
        }
      } else {
        const flagResult = parseSuccessFlag(statusResult.value.successFlag);
        if (!flagResult.ok) {
          return err(
            new KieApiError(
              `TaskPoller: task ${taskId.toString()} returned an unrecognized successFlag`,
              { cause: flagResult.error },
            ),
          );
        }

        const outcome = this.handleFlag(taskId, kind, flagResult.value, statusResult.value);
        if (outcome !== undefined) {
          return outcome;
        }
      }

      if (elapsedMs >= effectiveTimeoutMs) {
        return err(
          new TaskTimeoutError(
            `TaskPoller: task ${taskId.toString()} did not complete within ${effectiveTimeoutMs}ms`,
          ),
        );
      }

      const intervalMs =
        BACKOFF_SCHEDULE_MS[Math.min(backoffIndex, BACKOFF_SCHEDULE_MS.length - 1)]!;
      backoffIndex += 1;
      await this.sleep(intervalMs);
    }
  }

  /** Returns `undefined` when `flag` is still `PENDING` (caller should keep polling); otherwise a terminal `Result`. */
  private handleFlag(
    taskId: TaskId,
    kind: "video" | "image",
    flag: SuccessFlag,
    raw: RawTaskStatusResponse,
  ): Result<CompletedTask, GenerationFailedError | KieApiError> | undefined {
    if (flag === SuccessFlag.PENDING) {
      return undefined;
    }
    if (flag === SuccessFlag.SUCCESS) {
      return this.buildCompletedTask(taskId, kind, raw);
    }
    // SuccessFlag.FAILED (2) and SuccessFlag.GEN_FAILED (3) — design resolution #4.
    return err(
      new GenerationFailedError(
        `TaskPoller: Kie AI reported generation failure for task ${taskId.toString()} (successFlag=${flag})`,
        { successFlag: flag },
      ),
    );
  }

  private buildCompletedTask(
    taskId: TaskId,
    kind: "video" | "image",
    raw: RawTaskStatusResponse,
  ): Result<CompletedTask, KieApiError> {
    if (kind === "video") {
      if (!raw.videoUrl) {
        return err(
          new KieApiError(
            `TaskPoller: task ${taskId.toString()} succeeded but the response had no videoUrl`,
          ),
        );
      }
      const urlResult = MediaUrl.create(raw.videoUrl);
      if (!urlResult.ok) {
        return err(new KieApiError(urlResult.error.message, { cause: urlResult.error }));
      }
      return ok({ kind: "video", taskId, videoUrl: urlResult.value });
    }

    if (!raw.imageUrl) {
      return err(
        new KieApiError(
          `TaskPoller: task ${taskId.toString()} succeeded but the response had no imageUrl`,
        ),
      );
    }
    const imageUrlResult = MediaUrl.create(raw.imageUrl);
    if (!imageUrlResult.ok) {
      return err(new KieApiError(imageUrlResult.error.message, { cause: imageUrlResult.error }));
    }

    const rawImages = raw.images && raw.images.length > 0 ? raw.images : [raw.imageUrl];
    const images: MediaUrl[] = [];
    for (const url of rawImages) {
      const result = MediaUrl.create(url);
      if (!result.ok) {
        return err(new KieApiError(result.error.message, { cause: result.error }));
      }
      images.push(result.value);
    }

    return ok({ kind: "image", taskId, imageUrl: imageUrlResult.value, images });
  }
}
