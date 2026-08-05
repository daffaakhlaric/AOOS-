import { describe, expect, it } from "vitest";

import { executionWindowSchema } from "../../src/contracts/execution-window.js";

describe("Schema Test — executionWindowSchema", () => {
  it("accepts an empty window (no constraints)", () => {
    expect(executionWindowSchema.safeParse({}).success).toBe(true);
  });

  it("accepts earliestAt/latestAt", () => {
    expect(
      executionWindowSchema.safeParse({
        earliestAt: "2026-01-01T00:00:00.000Z",
        latestAt: "2026-01-02T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects an empty string for earliestAt", () => {
    expect(executionWindowSchema.safeParse({ earliestAt: "" }).success).toBe(false);
  });
});
