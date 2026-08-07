import { describe, expect, it } from "vitest";

import { KnowledgeQualityAssessmentMode } from "../../src/domain/knowledge-quality-assessment-mode.js";
import { KnowledgeQualityAssessmentState } from "../../src/domain/knowledge-quality-assessment-state.js";
import type { KnowledgeQualityExecution } from "../../src/domain/knowledge-quality-execution.js";
import { IllegalAssessmentTransitionException } from "../../src/errors/illegal-assessment-transition-exception.js";
import { KnowledgeQualityStateMachine } from "../../src/state-machine/knowledge-quality-state-machine.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(state: KnowledgeQualityAssessmentState): KnowledgeQualityExecution {
  return {
    instance: {
      id: "g-1",
      token: "kqua_sm",
      assessmentId: "g-1",
      tenantId: "tenant-1",
      state,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ assessmentId: "g-1" }),
    metadata: {
      assessmentId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      assessmentId: "g-1",
      mode: KnowledgeQualityAssessmentMode.FULL_ASSESSMENT,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    scoreMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeQualityStateMachine", () => {
  it("canTransition() reports true for a legal edge", () => {
    const machine = new KnowledgeQualityStateMachine();
    expect(
      machine.canTransition(
        KnowledgeQualityAssessmentState.DRAFT,
        KnowledgeQualityAssessmentState.QUEUED,
      ),
    ).toBe(true);
  });

  it("canTransition() reports false for an illegal edge", () => {
    const machine = new KnowledgeQualityStateMachine();
    expect(
      machine.canTransition(
        KnowledgeQualityAssessmentState.DRAFT,
        KnowledgeQualityAssessmentState.COMPLETED,
      ),
    ).toBe(false);
  });

  it("transition() appends a history entry", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.DRAFT);
    const result = machine.transition({
      execution,
      to: KnowledgeQualityAssessmentState.QUEUED,
      operation: "queue",
    });
    expect(result.instance.state).toBe(KnowledgeQualityAssessmentState.QUEUED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.fromState).toBe(KnowledgeQualityAssessmentState.DRAFT);
    expect(result.history[0]?.toState).toBe(KnowledgeQualityAssessmentState.QUEUED);
  });

  it("transition() throws IllegalAssessmentTransitionException for an illegal edge", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.DRAFT);
    expect(() =>
      machine.transition({ execution, to: KnowledgeQualityAssessmentState.COMPLETED }),
    ).toThrow(IllegalAssessmentTransitionException);
  });

  it("transition() stamps startedAt when entering Assessing", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.PREPARING);
    const result = machine.transition({ execution, to: KnowledgeQualityAssessmentState.ASSESSING });
    expect(result.instance.startedAt).toBeDefined();
  });

  it("transition() stamps completedAt when entering Completed", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.REVIEWING);
    const result = machine.transition({ execution, to: KnowledgeQualityAssessmentState.COMPLETED });
    expect(result.instance.completedAt).toBeDefined();
  });

  it("transition() does not stamp startedAt/completedAt for unrelated transitions", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.DRAFT);
    const result = machine.transition({ execution, to: KnowledgeQualityAssessmentState.QUEUED });
    expect(result.instance.startedAt).toBeUndefined();
    expect(result.instance.completedAt).toBeUndefined();
  });

  it("defaults operation to 'transition' when not supplied", () => {
    const machine = new KnowledgeQualityStateMachine();
    const execution = buildExecution(KnowledgeQualityAssessmentState.DRAFT);
    const result = machine.transition({ execution, to: KnowledgeQualityAssessmentState.QUEUED });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("assigns increasing sequence numbers across multiple transitions", () => {
    const machine = new KnowledgeQualityStateMachine();
    let execution = buildExecution(KnowledgeQualityAssessmentState.DRAFT);
    execution = machine.transition({ execution, to: KnowledgeQualityAssessmentState.QUEUED });
    execution = machine.transition({ execution, to: KnowledgeQualityAssessmentState.PREPARING });
    expect(execution.history.map((entry) => entry.sequence)).toEqual([0, 1]);
  });

  it("Destroyed has no legal outgoing transitions from the State Machine's perspective", () => {
    const machine = new KnowledgeQualityStateMachine();
    for (const target of Object.values(KnowledgeQualityAssessmentState)) {
      expect(machine.canTransition(KnowledgeQualityAssessmentState.DESTROYED, target)).toBe(false);
    }
  });
});
