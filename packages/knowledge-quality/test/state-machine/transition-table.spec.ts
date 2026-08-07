import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS,
  KnowledgeQualityAssessmentState,
} from "../../src/domain/knowledge-quality-assessment-state.js";
import { KnowledgeQualityStateMachine } from "../../src/state-machine/knowledge-quality-state-machine.js";

const machine = new KnowledgeQualityStateMachine();
const allStates = Object.values(KnowledgeQualityAssessmentState);

const legalPairs: Array<[KnowledgeQualityAssessmentState, KnowledgeQualityAssessmentState]> = [];
const illegalPairs: Array<[KnowledgeQualityAssessmentState, KnowledgeQualityAssessmentState]> = [];
for (const from of allStates) {
  for (const to of allStates) {
    if (from === to) {
      continue;
    }
    if (KNOWLEDGE_QUALITY_ASSESSMENT_STATE_TRANSITIONS[from].includes(to)) {
      legalPairs.push([from, to]);
    } else {
      illegalPairs.push([from, to]);
    }
  }
}

describe("KnowledgeQualityStateMachine — every legal transition-table edge", () => {
  it.each(legalPairs)("canTransition(%s -> %s) is true", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(true);
  });
});

describe("KnowledgeQualityStateMachine — every illegal (non-)edge", () => {
  it.each(illegalPairs)("canTransition(%s -> %s) is false", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(false);
  });
});

describe("KnowledgeQualityStateMachine — self-transitions are never legal", () => {
  it.each(allStates)("canTransition(%s -> %s) is false", (state) => {
    expect(machine.canTransition(state, state)).toBe(false);
  });
});
