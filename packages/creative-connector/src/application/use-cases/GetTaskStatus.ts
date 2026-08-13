import type { Result } from "@aos/common";

import type { ICreativeClient, RawTaskStatusResponse } from "../../contracts/ICreativeClient.js";
import type { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { TaskId } from "../../domain/value-objects/TaskId.js";

/** Raw one-shot task-status lookup (Part 4 of the spec), without the polling loop — for callers that want a single status check rather than a poll-to-completion. */
export class GetTaskStatus {
  constructor(private readonly client: ICreativeClient) {}

  async execute(
    taskId: TaskId,
  ): Promise<Result<RawTaskStatusResponse, KieApiError | RateLimitError>> {
    return this.client.getTaskStatus(taskId.toString());
  }
}
