import { describe, expect, it } from "vitest";

import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";

describe("KnowledgeUpdateJobStatus", () => {
  it("defines exactly 9 statuses", () => {
    expect(Object.values(KnowledgeUpdateJobStatus)).toHaveLength(9);
  });

  it("has no duplicate values", () => {
    const values = Object.values(KnowledgeUpdateJobStatus);
    expect(new Set(values).size).toBe(values.length);
  });

  it("includes every expected lifecycle status", () => {
    const expected = [
      "pending",
      "scheduled",
      "running",
      "retry_scheduled",
      "completed",
      "failed",
      "cancelled",
      "paused",
      "expired",
    ];
    expect([...Object.values(KnowledgeUpdateJobStatus)].sort()).toEqual(expected.sort());
  });
});
