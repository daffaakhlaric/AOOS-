import { describe, expect, it } from "vitest";

import { DEFAULT_MAX_LOOP_ITERATIONS } from "../../src/config/workflow-execution-config.js";

describe("Config Test — WorkflowExecutionConfig", () => {
  it("DEFAULT_MAX_LOOP_ITERATIONS is 1", () => {
    expect(DEFAULT_MAX_LOOP_ITERATIONS).toBe(1);
  });

  it("DEFAULT_MAX_LOOP_ITERATIONS is a positive integer", () => {
    expect(Number.isInteger(DEFAULT_MAX_LOOP_ITERATIONS)).toBe(true);
    expect(DEFAULT_MAX_LOOP_ITERATIONS).toBeGreaterThan(0);
  });
});
