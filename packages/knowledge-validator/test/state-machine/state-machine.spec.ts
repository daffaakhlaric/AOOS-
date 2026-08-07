import { describe, expect, it } from "vitest";

import { KnowledgeValidationCategory } from "../../src/domain/knowledge-validation-category.js";
import type { KnowledgeValidationExecution } from "../../src/domain/knowledge-validation-execution.js";
import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { IllegalValidationTransitionException } from "../../src/errors/illegal-validation-transition-exception.js";
import { KnowledgeValidatorStateMachine } from "../../src/state-machine/knowledge-validator-state-machine.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = "2026-01-01T00:00:00.000Z";

function buildExecution(state = KnowledgeValidationState.DRAFT): KnowledgeValidationExecution {
  const context = contextFixture({ validationId: "v-1" });
  return {
    instance: {
      id: "v-1",
      token: context.token,
      validationId: "v-1",
      tenantId: "t-1",
      state,
      createdAt: now,
      updatedAt: now,
    },
    context,
    metadata: {
      validationId: "v-1",
      title: "Title",
      tenantId: "t-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      validationId: "v-1",
      category: KnowledgeValidationCategory.STRUCTURE_VALIDATION,
      targetReference: "target-1",
      ruleIds: [],
      requestedBy: "user-1",
      createdAt: now,
    },
    resolvedRules: [],
    findings: [],
    resultMetadata: [],
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeValidatorStateMachine", () => {
  it("canTransition returns true for a legal edge", () => {
    const machine = new KnowledgeValidatorStateMachine();
    expect(
      machine.canTransition(KnowledgeValidationState.DRAFT, KnowledgeValidationState.QUEUED),
    ).toBe(true);
  });

  it("canTransition returns false for an illegal edge", () => {
    const machine = new KnowledgeValidatorStateMachine();
    expect(
      machine.canTransition(KnowledgeValidationState.DRAFT, KnowledgeValidationState.APPROVED),
    ).toBe(false);
  });

  it("transition moves the instance to the target state", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const result = machine.transition({
      execution: buildExecution(),
      to: KnowledgeValidationState.QUEUED,
    });
    expect(result.instance.state).toBe(KnowledgeValidationState.QUEUED);
  });

  it("transition appends one history entry", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const result = machine.transition({
      execution: buildExecution(),
      to: KnowledgeValidationState.QUEUED,
      operation: "queue_validation",
      reason: "auto",
    });
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.operation).toBe("queue_validation");
    expect(result.history[0]?.reason).toBe("auto");
    expect(result.history[0]?.fromState).toBe(KnowledgeValidationState.DRAFT);
    expect(result.history[0]?.toState).toBe(KnowledgeValidationState.QUEUED);
  });

  it("defaults operation to 'transition' when not supplied", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const result = machine.transition({
      execution: buildExecution(),
      to: KnowledgeValidationState.QUEUED,
    });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("stamps startedAt on the transition into Validating", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const execution = buildExecution(KnowledgeValidationState.PREPARING);
    const result = machine.transition({ execution, to: KnowledgeValidationState.VALIDATING });
    expect(result.instance.startedAt).toBeDefined();
  });

  it("does not stamp startedAt on unrelated transitions", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const result = machine.transition({
      execution: buildExecution(),
      to: KnowledgeValidationState.QUEUED,
    });
    expect(result.instance.startedAt).toBeUndefined();
  });

  it("stamps settledAt on the transition into Approved", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const execution = buildExecution(KnowledgeValidationState.REVIEWING);
    const result = machine.transition({ execution, to: KnowledgeValidationState.APPROVED });
    expect(result.instance.settledAt).toBeDefined();
  });

  it("stamps settledAt on the transition into Rejected", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const execution = buildExecution(KnowledgeValidationState.REVIEWING);
    const result = machine.transition({ execution, to: KnowledgeValidationState.REJECTED });
    expect(result.instance.settledAt).toBeDefined();
  });

  it("does not stamp settledAt on a Cancelled transition", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const execution = buildExecution(KnowledgeValidationState.DRAFT);
    const result = machine.transition({ execution, to: KnowledgeValidationState.CANCELLED });
    expect(result.instance.settledAt).toBeUndefined();
  });

  it("throws IllegalValidationTransitionException for an illegal edge", () => {
    const machine = new KnowledgeValidatorStateMachine();
    expect(() =>
      machine.transition({ execution: buildExecution(), to: KnowledgeValidationState.APPROVED }),
    ).toThrow(IllegalValidationTransitionException);
  });

  it("updates updatedAt on every transition", () => {
    const machine = new KnowledgeValidatorStateMachine();
    const result = machine.transition({
      execution: buildExecution(),
      to: KnowledgeValidationState.QUEUED,
    });
    expect(result.instance.updatedAt).toBeDefined();
  });

  it("increments history sequence numbers across multiple transitions", () => {
    const machine = new KnowledgeValidatorStateMachine();
    let execution = buildExecution();
    execution = machine.transition({ execution, to: KnowledgeValidationState.QUEUED });
    execution = machine.transition({ execution, to: KnowledgeValidationState.PREPARING });
    expect(execution.history.map((entry) => entry.sequence)).toEqual([0, 1]);
  });
});
