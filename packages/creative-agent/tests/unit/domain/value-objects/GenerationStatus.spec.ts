import { describe, expect, it } from "vitest";

import { GenerationStatus } from "../../../../src/domain/value-objects/GenerationStatus.js";

describe("GenerationStatus", () => {
  it("has exactly 4 members", () => {
    expect(Object.values(GenerationStatus)).toHaveLength(4);
  });

  it("covers PENDING, GENERATING, READY, FAILED", () => {
    expect(GenerationStatus.PENDING).toBe("PENDING");
    expect(GenerationStatus.GENERATING).toBe("GENERATING");
    expect(GenerationStatus.READY).toBe("READY");
    expect(GenerationStatus.FAILED).toBe("FAILED");
  });
});
