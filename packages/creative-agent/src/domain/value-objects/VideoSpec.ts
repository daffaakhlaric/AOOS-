import { err, ok, type Result } from "@aos/common";
import type { AspectRatio, VideoModel } from "@aos/creative-connector";
import { ValidationError } from "@aos/errors";

export interface VideoSpecProps {
  /** Total requested duration in seconds — 8 for a single un-extended Veo clip, 15/30 when `GenerateLongVideo` must extend. */
  readonly durationSeconds: number;
  readonly aspectRatio: AspectRatio;
  readonly model: VideoModel;
}

/**
 * Kai's decided video generation parameters (spec "Format Decision Logic" → "VideoSpec (when
 * video)"). Deliberately reuses `@aos/creative-connector`'s own `AspectRatio`/`VideoModel` enums
 * rather than redeclaring parallel ones — those are the exact literal unions the connector's
 * `GenerateLongVideo`/`GenerateVideoFromImage` use cases require, so reusing them keeps this
 * package's orchestration call sites type-safe with zero mapping layer.
 */
export class VideoSpec {
  private constructor(private readonly props: VideoSpecProps) {}

  static create(props: VideoSpecProps): Result<VideoSpec, ValidationError> {
    if (!Number.isFinite(props.durationSeconds) || props.durationSeconds <= 0) {
      return err(
        new ValidationError(
          `VideoSpec.durationSeconds must be a positive number, received: ${String(props.durationSeconds)}`,
        ),
      );
    }
    return ok(new VideoSpec(props));
  }

  get durationSeconds(): number {
    return this.props.durationSeconds;
  }

  get aspectRatio(): AspectRatio {
    return this.props.aspectRatio;
  }

  get model(): VideoModel {
    return this.props.model;
  }
}
