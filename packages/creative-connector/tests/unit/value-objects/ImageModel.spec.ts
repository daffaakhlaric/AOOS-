import { describe, expect, it } from "vitest";

import { ImageModel } from "../../../src/domain/value-objects/ImageModel.js";

describe("ImageModel", () => {
  it("NANO_BANANA_PRO is 'google/nano-banana-pro'", () => {
    expect(ImageModel.NANO_BANANA_PRO).toBe("google/nano-banana-pro");
  });

  it("has exactly 1 member", () => {
    expect(Object.values(ImageModel)).toHaveLength(1);
  });
});
