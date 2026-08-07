import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import type { KnowledgeGeneratorExecution } from "../../src/domain/knowledge-generator-execution.js";
import { IllegalGenerationTransitionException } from "../../src/errors/illegal-generation-transition-exception.js";
import { KnowledgeGeneratorStateMachine } from "../../src/state-machine/knowledge-generator-state-machine.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function buildExecution(state: KnowledgeGenerationState): KnowledgeGeneratorExecution {
  return {
    instance: {
      id: "g-1",
      token: "kgen_sm",
      generationId: "g-1",
      tenantId: "tenant-1",
      state,
      createdAt: now,
      updatedAt: now,
    },
    context: contextFixture({ generationId: "g-1" }),
    metadata: {
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      requestedBy: "user-1",
      createdAt: now,
    },
    history: [],
    auditTrail: [],
    logs: [],
  };
}

describe("KnowledgeGeneratorStateMachine", () => {
  it("canTransition() reports true for a legal edge", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    expect(
      machine.canTransition(KnowledgeGenerationState.DRAFT, KnowledgeGenerationState.QUEUED),
    ).toBe(true);
  });

  it("canTransition() reports false for an illegal edge", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    expect(
      machine.canTransition(KnowledgeGenerationState.DRAFT, KnowledgeGenerationState.COMPLETED),
    ).toBe(false);
  });

  it("transition() appends a history entry", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.DRAFT);
    const result = machine.transition({
      execution,
      to: KnowledgeGenerationState.QUEUED,
      operation: "queue",
    });
    expect(result.instance.state).toBe(KnowledgeGenerationState.QUEUED);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.fromState).toBe(KnowledgeGenerationState.DRAFT);
    expect(result.history[0]?.toState).toBe(KnowledgeGenerationState.QUEUED);
  });

  it("transition() throws IllegalGenerationTransitionException for an illegal edge", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.DRAFT);
    expect(() => machine.transition({ execution, to: KnowledgeGenerationState.COMPLETED })).toThrow(
      IllegalGenerationTransitionException,
    );
  });

  it("transition() stamps startedAt when entering Generating", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.PREPARING);
    const result = machine.transition({ execution, to: KnowledgeGenerationState.GENERATING });
    expect(result.instance.startedAt).toBeDefined();
  });

  it("transition() stamps completedAt when entering Completed", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.REVIEWING);
    const result = machine.transition({ execution, to: KnowledgeGenerationState.COMPLETED });
    expect(result.instance.completedAt).toBeDefined();
  });

  it("transition() does not stamp startedAt/completedAt for unrelated transitions", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.DRAFT);
    const result = machine.transition({ execution, to: KnowledgeGenerationState.QUEUED });
    expect(result.instance.startedAt).toBeUndefined();
    expect(result.instance.completedAt).toBeUndefined();
  });

  it("defaults operation to 'transition' when not supplied", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    const execution = buildExecution(KnowledgeGenerationState.DRAFT);
    const result = machine.transition({ execution, to: KnowledgeGenerationState.QUEUED });
    expect(result.history[0]?.operation).toBe("transition");
  });

  it("assigns increasing sequence numbers across multiple transitions", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    let execution = buildExecution(KnowledgeGenerationState.DRAFT);
    execution = machine.transition({ execution, to: KnowledgeGenerationState.QUEUED });
    execution = machine.transition({ execution, to: KnowledgeGenerationState.PREPARING });
    expect(execution.history.map((entry) => entry.sequence)).toEqual([0, 1]);
  });

  it("Destroyed has no legal outgoing transitions from the State Machine's perspective", () => {
    const machine = new KnowledgeGeneratorStateMachine();
    for (const target of Object.values(KnowledgeGenerationState)) {
      expect(machine.canTransition(KnowledgeGenerationState.DESTROYED, target)).toBe(false);
    }
  });
});
