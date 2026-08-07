import { describe, expect, it } from "vitest";

import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { KnowledgeVersionStateMachine } from "../../src/state-machine/knowledge-version-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeVersionStateMachine — full lifecycle paths", () => {
  const machine = new KnowledgeVersionStateMachine();

  function drive(states: readonly KnowledgeVersionState[]) {
    let execution = executionFixture();
    for (const to of states) {
      execution = machine.transition({ execution, to });
    }
    return execution;
  }

  it("drives Draft -> Created -> Validated -> Published -> Superseded -> Archived -> Restored", () => {
    const execution = drive([
      KnowledgeVersionState.CREATED,
      KnowledgeVersionState.VALIDATED,
      KnowledgeVersionState.PUBLISHED,
      KnowledgeVersionState.SUPERSEDED,
      KnowledgeVersionState.ARCHIVED,
      KnowledgeVersionState.RESTORED,
    ]);
    expect(execution.instance.state).toBe(KnowledgeVersionState.RESTORED);
    expect(execution.history).toHaveLength(6);
  });

  it("drives Draft -> Created -> Validated -> Published -> Deprecated -> Restored -> Published", () => {
    const execution = drive([
      KnowledgeVersionState.CREATED,
      KnowledgeVersionState.VALIDATED,
      KnowledgeVersionState.PUBLISHED,
      KnowledgeVersionState.DEPRECATED,
      KnowledgeVersionState.RESTORED,
      KnowledgeVersionState.PUBLISHED,
    ]);
    expect(execution.instance.state).toBe(KnowledgeVersionState.PUBLISHED);
  });

  it("drives Draft -> Created -> Validated -> Merged -> Superseded -> Destroyed", () => {
    const execution = drive([
      KnowledgeVersionState.CREATED,
      KnowledgeVersionState.VALIDATED,
      KnowledgeVersionState.MERGED,
      KnowledgeVersionState.SUPERSEDED,
      KnowledgeVersionState.DESTROYED,
    ]);
    expect(execution.instance.state).toBe(KnowledgeVersionState.DESTROYED);
  });

  it("drives Draft -> Created -> Validated -> Published -> RolledBack -> Restored -> Archived", () => {
    const execution = drive([
      KnowledgeVersionState.CREATED,
      KnowledgeVersionState.VALIDATED,
      KnowledgeVersionState.PUBLISHED,
      KnowledgeVersionState.ROLLED_BACK,
      KnowledgeVersionState.RESTORED,
      KnowledgeVersionState.ARCHIVED,
    ]);
    expect(execution.instance.state).toBe(KnowledgeVersionState.ARCHIVED);
  });

  it("every non-terminal state can reach Destroyed", () => {
    const nonTerminal = Object.values(KnowledgeVersionState).filter(
      (state) => state !== KnowledgeVersionState.DESTROYED,
    );
    for (const state of nonTerminal) {
      expect(machine.canTransition(state, KnowledgeVersionState.DESTROYED)).toBe(true);
    }
  });
});
