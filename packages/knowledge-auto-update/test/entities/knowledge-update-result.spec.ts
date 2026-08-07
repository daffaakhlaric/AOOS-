import { describe, expect, it } from "vitest";

import { KnowledgeUpdateResult } from "../../src/entities/knowledge-update-result.js";

describe("KnowledgeUpdateResult", () => {
  it("constructs a successful result", () => {
    const result = new KnowledgeUpdateResult({
      id: "result-1",
      taskId: "task-1",
      jobId: "job-1",
      success: true,
      appliedPayload: { a: 1 },
      errorMessage: undefined,
      durationMs: 5,
      completedAt: 100,
    });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({ a: 1 });
  });

  it("constructs a failed result", () => {
    const result = new KnowledgeUpdateResult({
      id: "result-2",
      taskId: "task-1",
      jobId: "job-1",
      success: false,
      appliedPayload: undefined,
      errorMessage: "boom",
      durationMs: 0,
      completedAt: 100,
    });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("boom");
  });

  it("is frozen", () => {
    const result = new KnowledgeUpdateResult({
      id: "r",
      taskId: "t",
      jobId: "j",
      success: true,
      appliedPayload: {},
      errorMessage: undefined,
      durationMs: 0,
      completedAt: 0,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("accepts durationMs of exactly 0", () => {
    expect(
      () =>
        new KnowledgeUpdateResult({
          id: "r",
          taskId: "t",
          jobId: "j",
          success: true,
          appliedPayload: {},
          errorMessage: undefined,
          durationMs: 0,
          completedAt: 0,
        }),
    ).not.toThrow();
  });

  it("throws on negative durationMs", () => {
    expect(
      () =>
        new KnowledgeUpdateResult({
          id: "r",
          taskId: "t",
          jobId: "j",
          success: true,
          appliedPayload: {},
          errorMessage: undefined,
          durationMs: -1,
          completedAt: 0,
        }),
    ).toThrow(RangeError);
  });
});
