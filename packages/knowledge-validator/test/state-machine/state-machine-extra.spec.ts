import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
  KnowledgeValidationState,
} from "../../src/domain/knowledge-validation-state.js";
import { KnowledgeValidatorStateMachine } from "../../src/state-machine/knowledge-validator-state-machine.js";

const ALL_EDGES: Array<[KnowledgeValidationState, KnowledgeValidationState]> = Object.entries(
  KNOWLEDGE_VALIDATION_STATE_TRANSITIONS,
).flatMap(([from, tos]) => tos.map((to) => [from as KnowledgeValidationState, to] as const));

const ILLEGAL_PAIRS: Array<[KnowledgeValidationState, KnowledgeValidationState]> = [
  [KnowledgeValidationState.DRAFT, KnowledgeValidationState.APPROVED],
  [KnowledgeValidationState.DRAFT, KnowledgeValidationState.REJECTED],
  [KnowledgeValidationState.DRAFT, KnowledgeValidationState.VALIDATING],
  [KnowledgeValidationState.DRAFT, KnowledgeValidationState.ARCHIVED],
  [KnowledgeValidationState.QUEUED, KnowledgeValidationState.DRAFT],
  [KnowledgeValidationState.QUEUED, KnowledgeValidationState.APPROVED],
  [KnowledgeValidationState.VALIDATING, KnowledgeValidationState.DRAFT],
  [KnowledgeValidationState.REVIEWING, KnowledgeValidationState.DRAFT],
  [KnowledgeValidationState.APPROVED, KnowledgeValidationState.REJECTED],
  [KnowledgeValidationState.REJECTED, KnowledgeValidationState.APPROVED],
  [KnowledgeValidationState.ARCHIVED, KnowledgeValidationState.APPROVED],
  [KnowledgeValidationState.DESTROYED, KnowledgeValidationState.DRAFT],
];

describe("KnowledgeValidatorStateMachine — full edge coverage", () => {
  const machine = new KnowledgeValidatorStateMachine();

  it.each(ALL_EDGES)("canTransition(%s, %s) is true", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(true);
  });

  it.each(ILLEGAL_PAIRS)("canTransition(%s, %s) is false", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(false);
  });

  it("has exactly 23 legal edges across the whole Lifecycle", () => {
    expect(ALL_EDGES).toHaveLength(23);
  });
});
