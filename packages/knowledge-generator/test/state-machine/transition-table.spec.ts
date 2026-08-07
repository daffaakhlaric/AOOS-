import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_GENERATION_STATE_TRANSITIONS,
  KnowledgeGenerationState,
} from "../../src/domain/knowledge-generation-state.js";
import { KnowledgeGeneratorStateMachine } from "../../src/state-machine/knowledge-generator-state-machine.js";

const machine = new KnowledgeGeneratorStateMachine();
const allStates = Object.values(KnowledgeGenerationState);

const legalPairs: Array<[KnowledgeGenerationState, KnowledgeGenerationState]> = [];
const illegalPairs: Array<[KnowledgeGenerationState, KnowledgeGenerationState]> = [];
for (const from of allStates) {
  for (const to of allStates) {
    if (from === to) {
      continue;
    }
    if (KNOWLEDGE_GENERATION_STATE_TRANSITIONS[from].includes(to)) {
      legalPairs.push([from, to]);
    } else {
      illegalPairs.push([from, to]);
    }
  }
}

describe("KnowledgeGeneratorStateMachine — every legal transition-table edge", () => {
  it.each(legalPairs)("canTransition(%s -> %s) is true", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(true);
  });
});

describe("KnowledgeGeneratorStateMachine — every illegal (non-)edge", () => {
  it.each(illegalPairs)("canTransition(%s -> %s) is false", (from, to) => {
    expect(machine.canTransition(from, to)).toBe(false);
  });
});

describe("KnowledgeGeneratorStateMachine — self-transitions are never legal", () => {
  it.each(allStates)("canTransition(%s -> %s) is false", (state) => {
    expect(machine.canTransition(state, state)).toBe(false);
  });
});
