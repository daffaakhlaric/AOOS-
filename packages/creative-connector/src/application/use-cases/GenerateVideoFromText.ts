import { err, ok, type Result } from "@aos/common";

import { GeneratedVideo } from "../../domain/entities/GeneratedVideo.js";
import type { GenerationFailedError } from "../../domain/errors/GenerationFailedError.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { TaskTimeoutError } from "../../domain/errors/TaskTimeoutError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";
import type { AspectRatio } from "../../domain/value-objects/AspectRatio.js";
import type { VideoModel } from "../../domain/value-objects/VideoModel.js";
import type { TaskPollingService } from "../services/TaskPollingService.js";
import type { VideoGenerationService } from "../services/VideoGenerationService.js";

export interface GenerateVideoFromTextInput {
  readonly prompt: string;
  readonly model: VideoModel;
  readonly aspectRatio: AspectRatio;
  readonly callbackUrl?: string;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
}

export type GenerateVideoFromTextError =
  KieApiError | RateLimitError | GenerationFailedError | TaskTimeoutError;

/**
 * The FALLBACK video-generation path for AAOS, used only when no source image is available (Part
 * 2 of the spec — text-to-video / `TEXT_2_VIDEO`). Same poll-then-publish shape as
 * `GenerateVideoFromImage`, just against `VideoGenerationService.generateFromText`.
 */
export class GenerateVideoFromText {
  constructor(
    private readonly videoService: VideoGenerationService,
    private readonly poller: TaskPollingService,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  async execute(
    input: GenerateVideoFromTextInput,
  ): Promise<Result<GeneratedVideo, GenerateVideoFromTextError>> {
    const taskResult = await this.videoService.generateFromText({
      prompt: input.prompt,
      model: input.model,
      aspectRatio: input.aspectRatio,
      callbackUrl: input.callbackUrl,
    });
    if (!taskResult.ok) {
      return taskResult;
    }
    const task = taskResult.value;

    const pollResult = await this.poller.pollUntilComplete(task.taskId, "video", input.timeoutMs);
    if (!pollResult.ok) {
      await this.events.publishVideoGenerationFailed(
        {
          taskId: task.taskId.toString(),
          reason: pollResult.error.message,
          occurredAt: this.now(),
          version: "1.0",
        },
        input.correlationId,
      );
      return pollResult;
    }

    const completed = pollResult.value;
    /* v8 ignore next 3 -- unreachable: this use case only ever polls a task it created as "video" via `videoService.generateFromText`, and `TaskPoller.pollUntilComplete` always returns a `CompletedTask` whose `kind` matches the `kind` argument it was called with. */
    if (completed.kind !== "video") {
      return err(
        new KieApiError(`GenerateVideoFromText: expected a video result, got "${completed.kind}"`),
      );
    }

    const videoResult = GeneratedVideo.create({
      taskId: task.taskId,
      videoUrl: completed.videoUrl,
      model: input.model,
      aspectRatio: input.aspectRatio,
    });
    /* v8 ignore next 3 -- unreachable: `GeneratedVideo.create` only rejects a non-positive `totalDurationSeconds`, which this use case never supplies. */
    if (!videoResult.ok) {
      return err(new KieApiError(videoResult.error.message, { cause: videoResult.error }));
    }

    await this.events.publishVideoGenerationCompleted(
      {
        taskId: task.taskId.toString(),
        videoUrl: completed.videoUrl.toString(),
        model: input.model,
        aspectRatio: input.aspectRatio,
        occurredAt: this.now(),
        version: "1.0",
      },
      input.correlationId,
    );

    return ok(videoResult.value);
  }
}
