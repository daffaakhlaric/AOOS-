import { err, ok, type Result } from "@aos/common";

import type { ICreativeClient } from "../../contracts/ICreativeClient.js";
import type {
  ExtendVideoParams,
  GenerateVideoFromImageParams,
  GenerateVideoFromTextParams,
  IVideoGenerator,
} from "../../contracts/IVideoGenerator.js";
import { GenerationTask } from "../../domain/entities/GenerationTask.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";
import { ExtendDurationSeconds } from "../../domain/value-objects/ExtendDurationSeconds.js";
import { GenerationType } from "../../domain/value-objects/GenerationType.js";
import { TaskId } from "../../domain/value-objects/TaskId.js";
import { TaskStatus } from "../../domain/value-objects/TaskStatus.js";

/**
 * Implements `IVideoGenerator` against the real Kie AI Veo 3.1 API (Part 2 + Part 5 of the spec).
 * Builds the exact JSON payload shapes shown in the spec, calls `ICreativeClient`, and — on
 * success — publishes `VideoGenerationStarted` and returns a `GenerationTask` for the caller
 * (typically `TaskPollingService` via a use-case) to poll to completion.
 */
export class VideoGenerationService implements IVideoGenerator {
  constructor(
    private readonly client: ICreativeClient,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
    private readonly defaultCallbackUrl?: string,
  ) {}

  async generateFromImage(
    params: GenerateVideoFromImageParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>> {
    const result = await this.client.generateVideoFromImage({
      prompt: params.prompt,
      imageUrls: [params.sourceImageUrl],
      model: params.model,
      aspect_ratio: params.aspectRatio,
      watermark: "",
      callBackUrl: params.callbackUrl ?? this.defaultCallbackUrl,
      enableFallback: false,
      enableTranslation: false,
      generationType: GenerationType.REFERENCE_2_VIDEO,
    });
    return this.toTask(result, params.model, GenerationType.REFERENCE_2_VIDEO);
  }

  async generateFromText(
    params: GenerateVideoFromTextParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>> {
    const result = await this.client.generateVideoFromText({
      prompt: params.prompt,
      model: params.model,
      aspect_ratio: params.aspectRatio,
      generationType: GenerationType.TEXT_2_VIDEO,
      callBackUrl: params.callbackUrl ?? this.defaultCallbackUrl,
    });
    return this.toTask(result, params.model, GenerationType.TEXT_2_VIDEO);
  }

  async extendVideo(
    params: ExtendVideoParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>> {
    const durationResult = ExtendDurationSeconds.create(params.additionalSeconds);
    if (!durationResult.ok) {
      return err(
        new KieApiError(`VideoGenerationService.extendVideo: ${durationResult.error.message}`, {
          cause: durationResult.error,
        }),
      );
    }

    const result = await this.client.extendVideo({
      taskId: params.taskId.toString(),
      duration: durationResult.value.seconds,
    });
    return this.toTask(result, undefined, undefined);
  }

  private async toTask(
    result: Result<{ taskId: string }, KieApiError | RateLimitError>,
    model: string | undefined,
    generationType: GenerationType | undefined,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>> {
    if (!result.ok) {
      return result;
    }

    const taskIdResult = TaskId.create(result.value.taskId);
    if (!taskIdResult.ok) {
      return err(new KieApiError(taskIdResult.error.message, { cause: taskIdResult.error }));
    }

    const taskResult = GenerationTask.create({
      taskId: taskIdResult.value,
      kind: "video",
      status: TaskStatus.PENDING,
      createdAt: this.now(),
    });
    /* v8 ignore next 3 -- unreachable: `GenerationTask.create` only rejects an invalid `kind`, and `kind` is always the literal "video" here. */
    if (!taskResult.ok) {
      return err(new KieApiError(taskResult.error.message, { cause: taskResult.error }));
    }

    await this.events.publishVideoGenerationStarted({
      taskId: taskIdResult.value.toString(),
      generationType: generationType ?? "EXTEND",
      model: model ?? "veo-extend",
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok(taskResult.value);
  }
}
