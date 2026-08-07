import { describe, expect, it } from "vitest";

import {
  KNOWLEDGE_POLICY_STATE_TRANSITIONS,
  KnowledgePolicyState,
} from "../../src/domain/knowledge-policy-state.js";
import { KnowledgePolicyStateMachine } from "../../src/state-machine/knowledge-policy-state-machine.js";

const allStates = Object.values(KnowledgePolicyState);

describe("KnowledgePolicyStateMachine — full transition matrix parity with the domain table", () => {
  const machine = new KnowledgePolicyStateMachine();

  it.each(allStates)(
    "canTransition() for %s matches KNOWLEDGE_POLICY_STATE_TRANSITIONS",
    (from) => {
      for (const to of allStates) {
        expect(machine.canTransition(from, to)).toBe(
          KNOWLEDGE_POLICY_STATE_TRANSITIONS[from].includes(to),
        );
      }
    },
  );
});
