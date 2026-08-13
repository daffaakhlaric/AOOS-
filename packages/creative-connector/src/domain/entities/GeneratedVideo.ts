import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { AspectRatio } from "../value-objects/AspectRatio.js";
import type { MediaUrl } from "../value-objects/MediaUrl.js";
import type { TaskId } from "../value-objects/TaskId.js";
import type { VideoModel } from "../value-objects/VideoModel.js";

export interface GeneratedVideoProps {
  readonly taskId: TaskId;
  readonly videoUrl: MediaUrl;
  readonly model: VideoModel;
  readonly aspectRatio: AspectRatio;
  /** Total duration across the initial generate call plus every extend call — `undefined` for a single un-extended clip whose exact duration Kie AI does not report back. */
  readonly totalDurationSeconds?: number;
}

/** A completed Veo video generation result — the terminal value `GenerateVideoFromImage`/`GenerateVideoFromText`/`GenerateLongVideo` resolve to. */
export class GeneratedVideo {
  private constructor(private readonly props: GeneratedVideoProps) {}

  static create(props: GeneratedVideoProps): Result<GeneratedVideo, ValidationError> {
    if (props.totalDurationSeconds !== undefined && props.totalDurationSeconds <= 0) {
      return err(
        new ValidationError("GeneratedVideo.totalDurationSeconds must be positive when provided"),
      );
    }
    return ok(new GeneratedVideo(props));
  }

  get taskId(): TaskId {
    return this.props.taskId;
  }

  get videoUrl(): MediaUrl {
    return this.props.videoUrl;
  }

  get model(): VideoModel {
    return this.props.model;
  }

  get aspectRatio(): AspectRatio {
    return this.props.aspectRatio;
  }

  get totalDurationSeconds(): number | undefined {
    return this.props.totalDurationSeconds;
  }
}
