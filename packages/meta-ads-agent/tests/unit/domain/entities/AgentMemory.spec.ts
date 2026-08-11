import { describe, expect, it } from "vitest";

import { AgentMemory } from "../../../../src/domain/entities/AgentMemory.js";

describe("AgentMemory", () => {
  it("starts empty", () => {
    const memory = new AgentMemory();
    expect(memory.decisionOutcomes.size).toBe(0);
    expect(memory.anglePerformance.size).toBe(0);
    expect(memory.timePerformance.size).toBe(0);
    expect(memory.campaignHistory.size).toBe(0);
    expect(memory.escalationOutcomes.size).toBe(0);
    expect(memory.decisionOutcomeCount).toBe(0);
  });

  it("recordDecisionOutcome accumulates decision outcomes correctly, keyed by decisionId", () => {
    const memory = new AgentMemory();
    memory.recordDecisionOutcome({
      decisionId: "d1",
      actionKind: "PAUSE",
      rphChatBeforeIDR: 20000,
      rphChatAfterIDR: null,
      recordedAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    expect(memory.decisionOutcomeCount).toBe(1);
    expect(memory.decisionOutcomes.get("d1")?.actionKind).toBe("PAUSE");

    memory.recordDecisionOutcome({
      decisionId: "d2",
      actionKind: "SCALE",
      rphChatBeforeIDR: 5000,
      rphChatAfterIDR: 4500,
      recordedAt: new Date("2026-08-09T00:00:00.000Z"),
    });
    expect(memory.decisionOutcomeCount).toBe(2);
  });

  it("recordAnglePerformance is updated after a cycle, keyed by unitBranchKey+angle", () => {
    const memory = new AgentMemory();
    memory.recordAnglePerformance({
      unitBranchKey: "BINTARO:Xpander",
      angle: "DP_RINGAN",
      sampleCount: 1,
      avgRphD3IDR: 6000,
    });
    expect(memory.anglePerformance.size).toBe(1);
    expect(memory.anglePerformance.get("BINTARO:Xpander::DP_RINGAN")?.avgRphD3IDR).toBe(6000);

    memory.recordAnglePerformance({
      unitBranchKey: "BINTARO:Xpander",
      angle: "DP_RINGAN",
      sampleCount: 2,
      avgRphD3IDR: 5500,
    });
    expect(memory.anglePerformance.size).toBe(1);
    expect(memory.anglePerformance.get("BINTARO:Xpander::DP_RINGAN")?.sampleCount).toBe(2);
  });

  it("recordTimePerformance keys by hour", () => {
    const memory = new AgentMemory();
    memory.recordTimePerformance(14, 7000);
    expect(memory.timePerformance.get(14)).toBe(7000);
  });

  it("appendCampaignHistory accumulates AdMetrics per adId across multiple calls", () => {
    const memory = new AgentMemory();
    const metricsA = { spend: { toNumber: () => 1 } } as never;
    const metricsB = { spend: { toNumber: () => 2 } } as never;
    memory.appendCampaignHistory("ad-1", metricsA);
    memory.appendCampaignHistory("ad-1", metricsB);
    expect(memory.campaignHistory.get("ad-1")).toHaveLength(2);
  });

  it("recordEscalationOutcome records APPROVED/REJECTED by decisionId", () => {
    const memory = new AgentMemory();
    memory.recordEscalationOutcome("d1", "APPROVED");
    memory.recordEscalationOutcome("d2", "REJECTED");
    expect(memory.escalationOutcomes.get("d1")).toBe("APPROVED");
    expect(memory.escalationOutcomes.get("d2")).toBe("REJECTED");
  });
});
