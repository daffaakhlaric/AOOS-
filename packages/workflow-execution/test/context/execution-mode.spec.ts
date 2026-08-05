import { describe, expect, it } from "vitest";

import { executionMetadataSchema } from "../../src/context/execution-metadata.js";
import { executionModeSchema } from "../../src/context/execution-mode-schema.js";
import { ExecutionMode } from "../../src/context/execution-mode.js";

describe("Context Test — ExecutionMode", () => {
  it("declares all 10 documented Execution Modes", () => {
    expect(Object.values(ExecutionMode)).toEqual([
      "sequential",
      "parallel",
      "conditional",
      "loop",
      "wait",
      "event_driven",
      "scheduled",
      "manual_approval",
      "compensation",
      "retry",
    ]);
  });

  it.each(Object.values(ExecutionMode))("executionModeSchema accepts '%s'", (mode) => {
    expect(executionModeSchema.safeParse(mode).success).toBe(true);
  });

  it("executionModeSchema rejects an unknown mode", () => {
    expect(executionModeSchema.safeParse("not-a-mode").success).toBe(false);
  });
});

describe("Context Test — executionMetadataSchema", () => {
  it("accepts an arbitrary free-form record", () => {
    expect(executionMetadataSchema.safeParse({ owner: "team-x", retries: 3 }).success).toBe(true);
  });

  it("accepts an empty object", () => {
    expect(executionMetadataSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-object value", () => {
    expect(executionMetadataSchema.safeParse("not-an-object").success).toBe(false);
  });
});
