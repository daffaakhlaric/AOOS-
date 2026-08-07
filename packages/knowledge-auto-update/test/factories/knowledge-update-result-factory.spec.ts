import { describe, expect, it } from "vitest";

import { KnowledgeUpdateResultFactory } from "../../src/factories/knowledge-update-result-factory.js";

describe("KnowledgeUpdateResultFactory", () => {
  it("createSuccess builds a successful result", () => {
    const result = new KnowledgeUpdateResultFactory().createSuccess(
      "task-1",
      "job-1",
      { a: 1 },
      50,
      1000,
    );
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({ a: 1 });
    expect(result.errorMessage).toBeUndefined();
    expect(result.durationMs).toBe(50);
    expect(result.completedAt).toBe(1000);
  });

  it("createFailure builds a failed result", () => {
    const result = new KnowledgeUpdateResultFactory().createFailure(
      "task-1",
      "job-1",
      "went wrong",
      10,
      2000,
    );
    expect(result.success).toBe(false);
    expect(result.appliedPayload).toBeUndefined();
    expect(result.errorMessage).toBe("went wrong");
  });

  it("generates unique ids", () => {
    const factory = new KnowledgeUpdateResultFactory();
    const a = factory.createSuccess("t", "j", {}, 0, 0);
    const b = factory.createFailure("t", "j", "x", 0, 0);
    expect(a.id).not.toBe(b.id);
  });
});
