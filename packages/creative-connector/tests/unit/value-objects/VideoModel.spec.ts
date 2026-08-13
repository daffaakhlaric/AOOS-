import { describe, expect, it } from "vitest";

import { VideoModel } from "../../../src/domain/value-objects/VideoModel.js";

describe("VideoModel", () => {
  it("VEO3 is 'veo3'", () => {
    expect(VideoModel.VEO3).toBe("veo3");
  });

  it("VEO3_FAST is 'veo3_fast'", () => {
    expect(VideoModel.VEO3_FAST).toBe("veo3_fast");
  });

  it("has exactly 2 members", () => {
    expect(Object.values(VideoModel)).toHaveLength(2);
  });
});
