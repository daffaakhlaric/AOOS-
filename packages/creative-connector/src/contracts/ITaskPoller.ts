import type { Result } from "@aos/common";

import type { GenerationFailedError } from "../domain/errors/GenerationFailedError.js";
import type { KieApiError } from "../domain/errors/KieApiError.js";
import type { RateLimitError } from "../domain/errors/RateLimitError.js";
import type { TaskTimeoutError } from "../domain/errors/TaskTimeoutError.js";
import type { MediaUrl } from "../domain/value-objects/MediaUrl.js";
import type { TaskId } from "../domain/value-objects/TaskId.js";

export interface CompletedVideoTask {
  readonly kind: "video";
  readonly taskId: TaskId;
  readonly videoUrl: MediaUrl;
}

export interface CompletedImageTask {
  readonly kind: "image";
  readonly taskId: TaskId;
  readonly imageUrl: MediaUrl;
  readonly images: readonly MediaUrl[];
}

export type CompletedTask = CompletedVideoTask | CompletedImageTask;

/** Port (Strategy Pattern: poll vs. callback — this package implements the poll strategy only) for waiting on an async Kie AI task to finish. The only implementation is `infrastructure/polling/TaskPoller.ts`. */
export interface ITaskPoller {
  pollUntilComplete(
    taskId: TaskId,
    kind: "video" | "image",
    timeoutMs?: number,
  ): Promise<
    Result<CompletedTask, TaskTimeoutError | GenerationFailedError | KieApiError | RateLimitError>
  >;
}
