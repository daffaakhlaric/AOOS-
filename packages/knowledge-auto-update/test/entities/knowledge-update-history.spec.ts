import { describe, expect, it } from "vitest";

import { KnowledgeUpdateHistory } from "../../src/entities/knowledge-update-history.js";
import { KnowledgeUpdateJobStatus } from "../../src/types/job-status.js";

describe("KnowledgeUpdateHistory", () => {
  it("empty() creates a history with no entries", () => {
    const history = KnowledgeUpdateHistory.empty("job-1");
    expect(history.jobId).toBe("job-1");
    expect(history.entries).toEqual([]);
  });

  it("is frozen, including entries", () => {
    const history = KnowledgeUpdateHistory.empty("job-1");
    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.entries)).toBe(true);
  });

  it("withEntry appends immutably", () => {
    const history = KnowledgeUpdateHistory.empty("job-1");
    const updated = history.withEntry({
      status: KnowledgeUpdateJobStatus.Running,
      at: 10,
      reason: "started",
    });
    expect(updated.entries).toHaveLength(1);
    expect(history.entries).toHaveLength(0);
  });

  it("latest returns the most recently appended entry", () => {
    const history = KnowledgeUpdateHistory.empty("job-1")
      .withEntry({ status: KnowledgeUpdateJobStatus.Pending, at: 0, reason: undefined })
      .withEntry({ status: KnowledgeUpdateJobStatus.Running, at: 10, reason: undefined })
      .withEntry({ status: KnowledgeUpdateJobStatus.Completed, at: 20, reason: undefined });
    expect(history.latest()?.status).toBe(KnowledgeUpdateJobStatus.Completed);
  });

  it("preserves entry order across many appends", () => {
    let history = KnowledgeUpdateHistory.empty("job-1");
    for (let i = 0; i < 5; i++) {
      history = history.withEntry({
        status: KnowledgeUpdateJobStatus.Running,
        at: i,
        reason: `step-${i}`,
      });
    }
    expect(history.entries.map((e) => e.reason)).toEqual([
      "step-0",
      "step-1",
      "step-2",
      "step-3",
      "step-4",
    ]);
  });

  it("latest returns undefined for an empty history", () => {
    expect(KnowledgeUpdateHistory.empty("job-1").latest()).toBeUndefined();
  });
});
