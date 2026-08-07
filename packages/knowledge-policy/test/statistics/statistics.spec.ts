import { describe, expect, it } from "vitest";

import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { KnowledgePolicyStatistics } from "../../src/statistics/knowledge-policy-statistics.js";

describe("KnowledgePolicyStatistics", () => {
  it("get() returns empty statistics for an unseen policy type", () => {
    const statistics = new KnowledgePolicyStatistics();
    expect(statistics.get(KnowledgePolicyType.ACCESS)).toEqual({
      createdCount: 0,
      activatedCount: 0,
      lastActivityAt: undefined,
    });
  });

  it("recordCreated() increments createdCount and stamps lastActivityAt", () => {
    const statistics = new KnowledgePolicyStatistics();
    const snapshot = statistics.recordCreated(KnowledgePolicyType.ACCESS);
    expect(snapshot.createdCount).toBe(1);
    expect(snapshot.activatedCount).toBe(0);
    expect(snapshot.lastActivityAt).toBeTruthy();
  });

  it("recordActivated() increments activatedCount", () => {
    const statistics = new KnowledgePolicyStatistics();
    statistics.recordCreated(KnowledgePolicyType.ACCESS);
    const snapshot = statistics.recordActivated(KnowledgePolicyType.ACCESS);
    expect(snapshot.createdCount).toBe(1);
    expect(snapshot.activatedCount).toBe(1);
  });

  it("keeps statistics independent per policy type", () => {
    const statistics = new KnowledgePolicyStatistics();
    statistics.recordCreated(KnowledgePolicyType.ACCESS);
    statistics.recordCreated(KnowledgePolicyType.RETENTION);
    statistics.recordCreated(KnowledgePolicyType.RETENTION);
    expect(statistics.get(KnowledgePolicyType.ACCESS).createdCount).toBe(1);
    expect(statistics.get(KnowledgePolicyType.RETENTION).createdCount).toBe(2);
  });
});
