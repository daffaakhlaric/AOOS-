import { describe, expect, it } from "vitest";

import { KnowledgeUpdateSnapshot } from "../../src/entities/knowledge-update-snapshot.js";

describe("KnowledgeUpdateSnapshot", () => {
  it("constructs with valid props", () => {
    const snapshot = new KnowledgeUpdateSnapshot({
      id: "snap-1",
      takenAt: 100,
      pendingJobCount: 1,
      completedJobCount: 2,
      cancelledJobCount: 0,
      expiredJobCount: 0,
      queueSize: 3,
    });
    expect(snapshot.pendingJobCount).toBe(1);
    expect(snapshot.queueSize).toBe(3);
  });

  it("carries every count field through unchanged", () => {
    const snapshot = new KnowledgeUpdateSnapshot({
      id: "snap-2",
      takenAt: 5,
      pendingJobCount: 1,
      completedJobCount: 2,
      cancelledJobCount: 3,
      expiredJobCount: 4,
      queueSize: 5,
    });
    expect(snapshot.completedJobCount).toBe(2);
    expect(snapshot.cancelledJobCount).toBe(3);
    expect(snapshot.expiredJobCount).toBe(4);
  });

  it("is frozen", () => {
    const snapshot = new KnowledgeUpdateSnapshot({
      id: "snap-1",
      takenAt: 0,
      pendingJobCount: 0,
      completedJobCount: 0,
      cancelledJobCount: 0,
      expiredJobCount: 0,
      queueSize: 0,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
