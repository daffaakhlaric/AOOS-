import { describe, expect, it } from "vitest";

import { GeneratedVideo } from "../../../../src/domain/entities/GeneratedVideo.js";
import { AspectRatio } from "../../../../src/domain/value-objects/AspectRatio.js";
import { MediaUrl } from "../../../../src/domain/value-objects/MediaUrl.js";
import { TaskId } from "../../../../src/domain/value-objects/TaskId.js";
import { VideoModel } from "../../../../src/domain/value-objects/VideoModel.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("GeneratedVideo", () => {
  it("creates a GeneratedVideo without totalDurationSeconds", () => {
    const video = unwrap(
      GeneratedVideo.create({
        taskId: unwrap(TaskId.create("task_1")),
        videoUrl: unwrap(MediaUrl.create("https://cdn.kie.ai/v.mp4")),
        model: VideoModel.VEO3_FAST,
        aspectRatio: AspectRatio.WIDESCREEN,
      }),
    );
    expect(video.taskId.toString()).toBe("task_1");
    expect(video.videoUrl.toString()).toBe("https://cdn.kie.ai/v.mp4");
    expect(video.model).toBe(VideoModel.VEO3_FAST);
    expect(video.aspectRatio).toBe(AspectRatio.WIDESCREEN);
    expect(video.totalDurationSeconds).toBeUndefined();
  });

  it("creates a GeneratedVideo with a positive totalDurationSeconds", () => {
    const video = unwrap(
      GeneratedVideo.create({
        taskId: unwrap(TaskId.create("task_1")),
        videoUrl: unwrap(MediaUrl.create("https://cdn.kie.ai/v.mp4")),
        model: VideoModel.VEO3,
        aspectRatio: AspectRatio.SQUARE,
        totalDurationSeconds: 15,
      }),
    );
    expect(video.totalDurationSeconds).toBe(15);
  });

  it("rejects a non-positive totalDurationSeconds", () => {
    const error = unwrapErr(
      GeneratedVideo.create({
        taskId: unwrap(TaskId.create("task_1")),
        videoUrl: unwrap(MediaUrl.create("https://cdn.kie.ai/v.mp4")),
        model: VideoModel.VEO3,
        aspectRatio: AspectRatio.SQUARE,
        totalDurationSeconds: 0,
      }),
    );
    expect(error.message).toMatch(/must be positive/);
  });
});
