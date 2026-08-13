import { err, ok, type Result } from "@aos/common";

import { GeneratedVideo } from "../../domain/entities/GeneratedVideo.js";
import type { GenerationFailedError } from "../../domain/errors/GenerationFailedError.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { TaskTimeoutError } from "../../domain/errors/TaskTimeoutError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";
import type { AspectRatio } from "../../domain/value-objects/AspectRatio.js";
import { VideoModel } from "../../domain/value-objects/VideoModel.js";
import type { TaskPollingService } from "../services/TaskPollingService.js";
import type { VideoGenerationService } from "../services/VideoGenerationService.js";

export interface GenerateLongVideoInput {
  readonly sourceImageUrl?: string;
  readonly prompt: string;
  /** e.g. 15, 30 — Kie AI clips are 8s max, so anything above 8s requires one or more `extendVideo` calls. */
  readonly targetDurationSeconds: number;
  readonly aspectRatio: AspectRatio;
  readonly model?: VideoModel;
  readonly callbackUrl?: string;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
}

export type GenerateLongVideoError =
  KieApiError | RateLimitError | GenerationFailedError | TaskTimeoutError;

const MAX_CLIP_SECONDS = 8;

/**
 * Implements the Long Video Flow (spec section of the same name): generate an initial clip (8s
 * max, image-to-video if `sourceImageUrl` is given, else text-to-video), then repeatedly
 * `extendVideo` by `min(remaining, 8)` seconds — polling to completion after every single call,
 * generate or extend — until `remaining <= 0`. Returns the final extend's `videoUrl`.
 *
 * Design resolution #3 (docs/AAOS-CREATIVE-CONNECTOR-REPORT.md): each `extendVideo` call's
 * `additionalSeconds` is validated through `ExtendDurationSeconds` (1-8, inclusive) inside
 * `VideoGenerationService.extendVideo` — NOT through the stricter 5-or-8-only `DurationSeconds`.
 * That is what makes the spec's own pinned arithmetic possible: targetDurationSeconds=15 yields
 * generate(8s) + extend(7s) = 2 total calls; targetDurationSeconds=30 yields
 * generate(8s) + extend(8s) + extend(8s) + extend(6s) = 4 total calls.
 */
export class GenerateLongVideo {
  constructor(
    private readonly videoService: VideoGenerationService,
    private readonly poller: TaskPollingService,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  async execute(
    input: GenerateLongVideoInput,
  ): Promise<Result<GeneratedVideo, GenerateLongVideoError>> {
    const model = input.model ?? VideoModel.VEO3_FAST;

    const generateResult = input.sourceImageUrl
      ? await this.videoService.generateFromImage({
          sourceImageUrl: input.sourceImageUrl,
          prompt: input.prompt,
          model,
          aspectRatio: input.aspectRatio,
          callbackUrl: input.callbackUrl,
        })
      : await this.videoService.generateFromText({
          prompt: input.prompt,
          model,
          aspectRatio: input.aspectRatio,
          callbackUrl: input.callbackUrl,
        });
    if (!generateResult.ok) {
      return generateResult;
    }
    let currentTask = generateResult.value;

    let pollResult = await this.poller.pollUntilComplete(
      currentTask.taskId,
      "video",
      input.timeoutMs,
    );
    if (!pollResult.ok) {
      return this.fail(currentTask.taskId.toString(), pollResult.error, input.correlationId);
    }
    let completed = pollResult.value;
    /* v8 ignore next 3 -- unreachable: every task this use case polls was created as "video" (initial generate or extend), and `TaskPoller` always returns a `CompletedTask` matching the requested `kind`. */
    if (completed.kind !== "video") {
      return err(
        new KieApiError(`GenerateLongVideo: expected a video result, got "${completed.kind}"`),
      );
    }

    let coveredSeconds = MAX_CLIP_SECONDS;
    let remaining = input.targetDurationSeconds - MAX_CLIP_SECONDS;

    while (remaining > 0) {
      const extendSeconds = Math.min(remaining, MAX_CLIP_SECONDS);

      const extendResult = await this.videoService.extendVideo({
        taskId: currentTask.taskId,
        additionalSeconds: extendSeconds,
      });
      if (!extendResult.ok) {
        return this.fail(currentTask.taskId.toString(), extendResult.error, input.correlationId);
      }
      currentTask = extendResult.value;

      pollResult = await this.poller.pollUntilComplete(
        currentTask.taskId,
        "video",
        input.timeoutMs,
      );
      if (!pollResult.ok) {
        return this.fail(currentTask.taskId.toString(), pollResult.error, input.correlationId);
      }
      completed = pollResult.value;
      /* v8 ignore next 3 -- unreachable: same reasoning as the initial-generate check above. */
      if (completed.kind !== "video") {
        return err(
          new KieApiError(`GenerateLongVideo: expected a video result, got "${completed.kind}"`),
        );
      }

      coveredSeconds += extendSeconds;
      remaining -= MAX_CLIP_SECONDS;
    }

    const videoResult = GeneratedVideo.create({
      taskId: currentTask.taskId,
      videoUrl: completed.videoUrl,
      model,
      aspectRatio: input.aspectRatio,
      totalDurationSeconds: coveredSeconds,
    });
    /* v8 ignore next 3 -- unreachable: `GeneratedVideo.create` only rejects a non-positive `totalDurationSeconds`, and `coveredSeconds` here is always >= 8. */
    if (!videoResult.ok) {
      return err(new KieApiError(videoResult.error.message, { cause: videoResult.error }));
    }

    await this.events.publishVideoGenerationCompleted(
      {
        taskId: currentTask.taskId.toString(),
        videoUrl: completed.videoUrl.toString(),
        model,
        aspectRatio: input.aspectRatio,
        occurredAt: this.now(),
        version: "1.0",
      },
      input.correlationId,
    );

    return ok(videoResult.value);
  }

  private async fail(
    taskId: string,
    error: GenerateLongVideoError,
    correlationId: string | undefined,
  ): Promise<Result<GeneratedVideo, GenerateLongVideoError>> {
    await this.events.publishVideoGenerationFailed(
      { taskId, reason: error.message, occurredAt: this.now(), version: "1.0" },
      correlationId,
    );
    return err(error);
  }
}
