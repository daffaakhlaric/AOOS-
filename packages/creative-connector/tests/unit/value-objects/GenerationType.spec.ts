import { describe, expect, it } from "vitest";

import { GenerationType } from "../../../src/domain/value-objects/GenerationType.js";

describe("GenerationType", () => {
  it("TEXT_2_VIDEO is 'TEXT_2_VIDEO'", () => {
    expect(GenerationType.TEXT_2_VIDEO).toBe("TEXT_2_VIDEO");
  });

  it("REFERENCE_2_VIDEO is 'REFERENCE_2_VIDEO'", () => {
    expect(GenerationType.REFERENCE_2_VIDEO).toBe("REFERENCE_2_VIDEO");
  });

  it("has exactly 2 members", () => {
    expect(Object.values(GenerationType)).toHaveLength(2);
  });
});
