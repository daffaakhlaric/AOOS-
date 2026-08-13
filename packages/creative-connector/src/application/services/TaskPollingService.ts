import type { Result } from "@aos/common";

import type { CompletedTask, ITaskPoller } from "../../contracts/ITaskPoller.js";
import type { GenerationFailedError } from "../../domain/errors/GenerationFailedError.js";
import type { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { TaskTimeoutError } from "../../domain/errors/TaskTimeoutError.js";
import type { TaskId } from "../../domain/value-objects/TaskId.js";

/**
 * Thin application-layer wrapper over the `ITaskPoller` port — kept separate from
 * `infrastructure/polling/TaskPoller.ts` per Hexagonal Architecture (Constitution §3.11): use
 * cases depend on this application service, never directly on the polling infrastructure class.
 * Deliberately has no side effects of its own (no event emission) — callers (the use cases) own
 * translating a completed/failed poll into `VideoGenerationCompleted`/`Failed` or
 * `ImageGenerationCompleted`/`Failed`, since only they hold the model/aspect-ratio context needed
 * to build those event payloads.
 */
export class TaskPollingService {
  constructor(private readonly poller: ITaskPoller) {}

  async pollUntilComplete(
    taskId: TaskId,
    kind: "video" | "image",
    timeoutMs?: number,
  ): Promise<
    Result<CompletedTask, TaskTimeoutError | GenerationFailedError | KieApiError | RateLimitError>
  > {
    return this.poller.pollUntilComplete(taskId, kind, timeoutMs);
  }
}
