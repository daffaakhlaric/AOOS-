import { err, ok, type Result } from "@aos/common";
import type { AspectRatio, ImageModel } from "@aos/creative-connector";
import { ValidationError } from "@aos/errors";

export interface ImageSpecProps {
  readonly count: number;
  readonly aspectRatio: AspectRatio;
  readonly model: ImageModel;
}

/**
 * Kai's decided image generation parameters (spec "Format Decision Logic" → "ImageSpec"). Reuses
 * `@aos/creative-connector`'s own `AspectRatio`/`ImageModel` enums for the same reason `VideoSpec`
 * does — zero mapping layer between this package's decisions and the connector's call sites.
 */
export class ImageSpec {
  private constructor(private readonly props: ImageSpecProps) {}

  static create(props: ImageSpecProps): Result<ImageSpec, ValidationError> {
    if (!Number.isInteger(props.count) || props.count <= 0) {
      return err(
        new ValidationError(
          `ImageSpec.count must be a positive integer, received: ${String(props.count)}`,
        ),
      );
    }
    return ok(new ImageSpec(props));
  }

  get count(): number {
    return this.props.count;
  }

  get aspectRatio(): AspectRatio {
    return this.props.aspectRatio;
  }

  get model(): ImageModel {
    return this.props.model;
  }
}
