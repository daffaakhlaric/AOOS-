import { describe, expect, it } from "vitest";

import { KnowledgeVersionState } from "../../src/domain/knowledge-version-state.js";
import { IllegalVersionTransitionException } from "../../src/errors/illegal-version-transition-exception.js";
import { KnowledgeVersionStateMachine } from "../../src/state-machine/knowledge-version-state-machine.js";
import { executionFixture } from "../helpers/execution-fixture.js";

describe("KnowledgeVersionStateMachine", () => {
  const machine = new KnowledgeVersionStateMachine();

  it("canTransition() reflects the transition table", () => {
    expect(machine.canTransition(KnowledgeVersionState.DRAFT, KnowledgeVersionState.CREATED)).toBe(
      true,
    );
    expect(
      machine.canTransition(KnowledgeVersionState.DRAFT, KnowledgeVersionState.PUBLISHED),
    ).toBe(false);
  });

  it("performs a legal transition, appending a history entry and stamping updatedAt", () => {
    const execution = executionFixture();
    const result = machine.transition({
      execution,
      to: KnowledgeVersionState.CREATED,
      operation: "createVersion",
      reason: "initial",
    });
    expect(result.instance.state).toBe(KnowledgeVersionState.CREATED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.fromState).toBe(KnowledgeVersionState.DRAFT);
    expect(result.history[0]?.toState).toBe(KnowledgeVersionState.CREATED);
    expect(result.history[0]?.reason).toBe("initial");
    expect(result.instance.updatedAt).toBeTruthy();
  });

  it("defaults operation to 'transition' when not supplied", () => {
    const execution = executionFixture();
    const result = machine.transition({ execution, to: KnowledgeVersionState.CREATED });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("stamps publishedAt when transitioning to PUBLISHED", () => {
    let execution = executionFixture();
    execution = machine.transition({ execution, to: KnowledgeVersionState.CREATED });
    execution = machine.transition({ execution, to: KnowledgeVersionState.VALIDATED });
    execution = machine.transition({ execution, to: KnowledgeVersionState.PUBLISHED });
    expect(execution.instance.publishedAt).toBeTruthy();
  });

  it("stamps destroyedAt when transitioning to DESTROYED", () => {
    const execution = executionFixture();
    const result = machine.transition({ execution, to: KnowledgeVersionState.DESTROYED });
    expect(result.instance.destroyedAt).toBeTruthy();
  });

  it("rejects an illegal transition", () => {
    const execution = executionFixture();
    expect(() => machine.transition({ execution, to: KnowledgeVersionState.PUBLISHED })).toThrow(
      IllegalVersionTransitionException,
    );
  });

  it("rejects any transition out of the terminal DESTROYED state", () => {
    const execution = executionFixture({
      instance: {
        ...executionFixture().instance,
        state: KnowledgeVersionState.DESTROYED,
      },
    });
    expect(() => machine.transition({ execution, to: KnowledgeVersionState.RESTORED })).toThrow(
      IllegalVersionTransitionException,
    );
  });
});
