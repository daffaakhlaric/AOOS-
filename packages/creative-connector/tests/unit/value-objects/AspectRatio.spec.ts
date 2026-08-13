import { describe, expect, it } from "vitest";

import { AspectRatio } from "../../../src/domain/value-objects/AspectRatio.js";

describe("AspectRatio", () => {
  it("WIDESCREEN is '16:9'", () => {
    expect(AspectRatio.WIDESCREEN).toBe("16:9");
  });

  it("VERTICAL is '9:16'", () => {
    expect(AspectRatio.VERTICAL).toBe("9:16");
  });

  it("SQUARE is '1:1'", () => {
    expect(AspectRatio.SQUARE).toBe("1:1");
  });

  it("has exactly 3 members", () => {
    expect(Object.values(AspectRatio)).toHaveLength(3);
  });
});
