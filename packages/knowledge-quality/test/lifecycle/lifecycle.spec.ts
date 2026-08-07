import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityLifecycle } from "../../src/lifecycle/knowledge-quality-lifecycle.js";

describe("KnowledgeQualityLifecycle", () => {
  const lifecycle = new KnowledgeQualityLifecycle();

  it("states() returns all 10 states", () => {
    expect(lifecycle.states()).toHaveLength(10);
  });

  it("transitionsFrom() mirrors the transition table for Draft", () => {
    expect(lifecycle.transitionsFrom(KnowledgeQualityAssessmentState.DRAFT)).toEqual([
      KnowledgeQualityAssessmentState.QUEUED,
      KnowledgeQualityAssessmentState.CANCELLED,
      KnowledgeQualityAssessmentState.DESTROYED,
    ]);
  });

  it("transitionsFrom() returns an empty array for Destroyed", () => {
    expect(lifecycle.transitionsFrom(KnowledgeQualityAssessmentState.DESTROYED)).toEqual([]);
  });

  it("isTerminal() is true only for Destroyed", () => {
    for (const state of lifecycle.states()) {
      expect(lifecycle.isTerminal(state)).toBe(state === KnowledgeQualityAssessmentState.DESTROYED);
    }
  });

  it("isSettled() is true for Completed/Cancelled/Failed/Archived/Destroyed", () => {
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.COMPLETED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.CANCELLED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.FAILED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.ARCHIVED)).toBe(true);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.DESTROYED)).toBe(true);
  });

  it("isSettled() is false for Draft/Queued/Preparing/Assessing/Reviewing", () => {
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.DRAFT)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.QUEUED)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.PREPARING)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.ASSESSING)).toBe(false);
    expect(lifecycle.isSettled(KnowledgeQualityAssessmentState.REVIEWING)).toBe(false);
  });

  it("every state is reachable from Draft via transitionsFrom()", () => {
    const reachable = new Set<KnowledgeQualityAssessmentState>([
      KnowledgeQualityAssessmentState.DRAFT,
    ]);
    let frontier = [KnowledgeQualityAssessmentState.DRAFT];
    while (frontier.length > 0) {
      const next: KnowledgeQualityAssessmentState[] = [];
      for (const state of frontier) {
        for (const target of lifecycle.transitionsFrom(state)) {
          if (!reachable.has(target)) {
            reachable.add(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }
    expect(reachable.size).toBe(lifecycle.states().length);
  });
});
