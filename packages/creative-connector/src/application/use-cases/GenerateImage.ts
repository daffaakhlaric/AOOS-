import { err, ok, type Result } from "@aos/common";

import { GeneratedImage } from "../../domain/entities/GeneratedImage.js";
import type { GenerationFailedError } from "../../domain/errors/GenerationFailedError.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { TaskTimeoutError } from "../../domain/errors/TaskTimeoutError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";
import type { AspectRatio } from "../../domain/value-objects/AspectRatio.js";
import { ImageModel } from "../../domain/value-objects/ImageModel.js";
import type { ImageGenerationService } from "../services/ImageGenerationService.js";
import type { TaskPollingService } from "../services/TaskPollingService.js";

export interface GenerateImageInput {
  readonly sourceImageUrls?: readonly string[];
  readonly prompt: string;
  readonly aspectRatio: AspectRatio;
  readonly outputFormat?: "jpg" | "png";
  readonly callbackUrl?: string;
  readonly correlationId?: string;
  readonly timeoutMs?: number;
}

export type GenerateImageError =
  KieApiError | RateLimitError | GenerationFailedError | TaskTimeoutError;

/**
 * Nano Banana Pro image-to-image generation (Part 3 of the spec): calls
 * `ImageGenerationService.generate`, polls to completion, and publishes
 * `ImageGenerationCompleted`/`ImageGenerationFailed`.
 */
export class GenerateImage {
  constructor(
    private readonly imageService: ImageGenerationService,
    private readonly poller: TaskPollingService,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
  ) {}

  async execute(input: GenerateImageInput): Promise<Result<GeneratedImage, GenerateImageError>> {
    const taskResult = await this.imageService.generate({
      sourceImageUrls: input.sourceImageUrls,
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      outputFormat: input.outputFormat,
      callbackUrl: input.callbackUrl,
    });
    if (!taskResult.ok) {
      return taskResult;
    }
    const task = taskResult.value;

    const pollResult = await this.poller.pollUntilComplete(task.taskId, "image", input.timeoutMs);
    if (!pollResult.ok) {
      await this.events.publishImageGenerationFailed(
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
    /* v8 ignore next 3 -- unreachable: this use case only ever polls a task it created as "image" via `imageService.generate`, and `TaskPoller.pollUntilComplete` always returns a `CompletedTask` whose `kind` matches the `kind` argument it was called with. */
    if (completed.kind !== "image") {
      return err(
        new KieApiError(`GenerateImage: expected an image result, got "${completed.kind}"`),
      );
    }

    const imageResult = GeneratedImage.create({
      taskId: task.taskId,
      imageUrl: completed.imageUrl,
      images: completed.images,
      model: ImageModel.NANO_BANANA_PRO,
      aspectRatio: input.aspectRatio,
    });
    /* v8 ignore next 3 -- unreachable: `GeneratedImage.create` has no failure path (it validates nothing), always `ok`. */
    if (!imageResult.ok) {
      return err(new KieApiError(imageResult.error.message, { cause: imageResult.error }));
    }

    await this.events.publishImageGenerationCompleted(
      {
        taskId: task.taskId.toString(),
        imageUrl: completed.imageUrl.toString(),
        model: ImageModel.NANO_BANANA_PRO,
        aspectRatio: input.aspectRatio,
        occurredAt: this.now(),
        version: "1.0",
      },
      input.correlationId,
    );

    return ok(imageResult.value);
  }
}
