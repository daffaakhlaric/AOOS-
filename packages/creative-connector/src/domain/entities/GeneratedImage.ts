import { ok, type Result } from "@aos/common";
import type { ValidationError } from "@aos/errors";

import type { AspectRatio } from "../value-objects/AspectRatio.js";
import type { ImageModel } from "../value-objects/ImageModel.js";
import type { MediaUrl } from "../value-objects/MediaUrl.js";
import type { TaskId } from "../value-objects/TaskId.js";

export interface GeneratedImageProps {
  readonly taskId: TaskId;
  readonly imageUrl: MediaUrl;
  /** Some Kie AI models return multiple image variants in `data.images`; always includes at least `imageUrl` itself. */
  readonly images: ReadonlyArray<MediaUrl>;
  readonly model: ImageModel;
  readonly aspectRatio: AspectRatio;
}

/** A completed Nano Banana Pro image generation result — the terminal value `GenerateImage` resolves to. */
export class GeneratedImage {
  private constructor(private readonly props: GeneratedImageProps) {}

  static create(props: GeneratedImageProps): Result<GeneratedImage, ValidationError> {
    return ok(new GeneratedImage({ ...props, images: [...props.images] }));
  }

  get taskId(): TaskId {
    return this.props.taskId;
  }

  get imageUrl(): MediaUrl {
    return this.props.imageUrl;
  }

  get images(): ReadonlyArray<MediaUrl> {
    return this.props.images;
  }

  get model(): ImageModel {
    return this.props.model;
  }

  get aspectRatio(): AspectRatio {
    return this.props.aspectRatio;
  }
}
