import { err, ok, type Result } from "@aos/common";

import type { ICreativeClient } from "../../contracts/ICreativeClient.js";
import type { GenerateImageParams, IImageGenerator } from "../../contracts/IImageGenerator.js";
import { GenerationTask } from "../../domain/entities/GenerationTask.js";
import { KieApiError } from "../../domain/errors/KieApiError.js";
import type { RateLimitError } from "../../domain/errors/RateLimitError.js";
import type { CreativeConnectorEvents } from "../../domain/events/CreativeConnectorEvents.js";
import { ImageModel } from "../../domain/value-objects/ImageModel.js";
import { TaskId } from "../../domain/value-objects/TaskId.js";
import { TaskStatus } from "../../domain/value-objects/TaskStatus.js";

const DEFAULT_OUTPUT_FORMAT = "jpg";

/**
 * Implements `IImageGenerator` against the real Kie AI Nano Banana Pro API (Part 3 of the spec).
 * Builds the exact `POST /api/v1/jobs/createTask` payload shape shown in the spec
 * (`model: "google/nano-banana-pro"`), never the Veo video path — Part 3 vs. Part 2 use different
 * hosts' *paths* on the same `api.kie.ai` host, which is the exact confusion the spec calls out
 * ("NOT /api/v1/jobs/createTask (that's for market models)" for video).
 */
export class ImageGenerationService implements IImageGenerator {
  constructor(
    private readonly client: ICreativeClient,
    private readonly events: CreativeConnectorEvents,
    private readonly now: () => Date = (): Date => new Date(),
    private readonly defaultCallbackUrl?: string,
  ) {}

  async generate(
    params: GenerateImageParams,
  ): Promise<Result<GenerationTask, KieApiError | RateLimitError>> {
    const result = await this.client.generateImage({
      model: ImageModel.NANO_BANANA_PRO,
      callBackUrl: params.callbackUrl ?? this.defaultCallbackUrl,
      input: {
        prompt: params.prompt,
        ...(params.sourceImageUrl ? { image_url: params.sourceImageUrl } : {}),
        output_format: params.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
        aspect_ratio: params.aspectRatio,
      },
    });

    if (!result.ok) {
      return result;
    }

    const taskIdResult = TaskId.create(result.value.taskId);
    if (!taskIdResult.ok) {
      return err(new KieApiError(taskIdResult.error.message, { cause: taskIdResult.error }));
    }

    const taskResult = GenerationTask.create({
      taskId: taskIdResult.value,
      kind: "image",
      status: TaskStatus.PENDING,
      createdAt: this.now(),
    });
    /* v8 ignore next 3 -- unreachable: `GenerationTask.create` only rejects an invalid `kind`, and `kind` is always the literal "image" here. */
    if (!taskResult.ok) {
      return err(new KieApiError(taskResult.error.message, { cause: taskResult.error }));
    }

    await this.events.publishImageGenerationStarted({
      taskId: taskIdResult.value.toString(),
      model: ImageModel.NANO_BANANA_PRO,
      occurredAt: this.now(),
      version: "1.0",
    });

    return ok(taskResult.value);
  }
}
