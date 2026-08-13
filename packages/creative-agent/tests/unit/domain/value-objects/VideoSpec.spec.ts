import { AspectRatio, VideoModel } from "@aos/creative-connector";
import { describe, expect, it } from "vitest";

import { VideoSpec } from "../../../../src/domain/value-objects/VideoSpec.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("VideoSpec", () => {
  it("create() accepts a positive durationSeconds", () => {
    const spec = unwrap(
      VideoSpec.create({
        durationSeconds: 15,
        aspectRatio: AspectRatio.WIDESCREEN,
        model: VideoModel.VEO3_FAST,
      }),
    );
    expect(spec.durationSeconds).toBe(15);
    expect(spec.aspectRatio).toBe(AspectRatio.WIDESCREEN);
    expect(spec.model).toBe(VideoModel.VEO3_FAST);
  });

  it("create() rejects a zero durationSeconds", () => {
    const error = unwrapErr(
      VideoSpec.create({
        durationSeconds: 0,
        aspectRatio: AspectRatio.WIDESCREEN,
        model: VideoModel.VEO3,
      }),
    );
    expect(error.message).toContain("durationSeconds");
  });

  it("create() rejects a negative durationSeconds", () => {
    const error = unwrapErr(
      VideoSpec.create({
        durationSeconds: -5,
        aspectRatio: AspectRatio.VERTICAL,
        model: VideoModel.VEO3,
      }),
    );
    expect(error.message).toContain("positive");
  });
});
