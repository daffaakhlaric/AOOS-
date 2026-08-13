import { describe, expect, it } from "vitest";

import { CreativeFormat } from "../../../../src/domain/value-objects/CreativeFormat.js";

describe("CreativeFormat", () => {
  it("has exactly 2 members", () => {
    expect(Object.values(CreativeFormat)).toHaveLength(2);
  });

  it("VIDEO_AND_IMAGES renders as the literal string", () => {
    expect(CreativeFormat.VIDEO_AND_IMAGES).toBe("VIDEO_AND_IMAGES");
  });

  it("IMAGES_ONLY renders as the literal string", () => {
    expect(CreativeFormat.IMAGES_ONLY).toBe("IMAGES_ONLY");
  });
});
