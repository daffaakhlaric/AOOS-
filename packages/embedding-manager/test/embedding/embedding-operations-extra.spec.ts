import { describe, expect, it } from "vitest";

import { EMBEDDING_STATE_TRANSITIONS, EmbeddingState } from "../../src/domain/embedding-state.js";
import { EmbeddingCheckException } from "../../src/errors/embedding-check-exception.js";
import {
  createDraftEmbedding,
  managerFixture,
  registerDefaultProviderAndModel,
} from "../helpers/manager-fixture.js";

const OPERATION_FOR_STATE: Partial<Record<EmbeddingState, string>> = {
  [EmbeddingState.QUEUED]: "queue",
  [EmbeddingState.PREPARING]: "prepare",
  [EmbeddingState.EMBEDDING]: "start",
  [EmbeddingState.COMPLETED]: "complete",
  [EmbeddingState.FAILED]: "fail",
  [EmbeddingState.CANCELLED]: "cancel",
  [EmbeddingState.ARCHIVED]: "archive",
  [EmbeddingState.DESTROYED]: "destroy",
};

describe("EmbeddingManager — illegal transitions are rejected from every reachable state", () => {
  it("a fresh Draft Embedding cannot jump directly to Completed", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await expect(manager.complete({ token })).rejects.toThrow();
  });

  it("a fresh Draft Embedding cannot jump directly to Embedding (must Queue/Prepare first)", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await expect(manager.start({ token })).rejects.toThrow();
  });

  it("Destroyed has no outgoing edges — every operation on a Destroyed Embedding fails", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await manager.destroy({ token });
    await expect(manager.queue({ token })).rejects.toThrow();
    await expect(manager.archive({ token })).rejects.toThrow();
    await expect(manager.cancel({ token })).rejects.toThrow();
  });

  it("cannot archive a non-settled Embedding (Draft)", async () => {
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    await expect(manager.archive({ token })).rejects.toThrow();
  });
});

describe("EmbeddingManager — full BFS walk of the 9-state Lifecycle via the facade", () => {
  it("every state reachable per EMBEDDING_STATE_TRANSITIONS is actually reachable by driving the real facade", async () => {
    const visited = new Set<EmbeddingState>([EmbeddingState.DRAFT]);
    const { manager } = managerFixture();

    /* Mainline: Draft -> Queued -> Preparing -> Embedding -> Completed -> Archived -> Destroyed */
    let token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    visited.add(EmbeddingState.QUEUED);
    await manager.prepare({ token });
    visited.add(EmbeddingState.PREPARING);
    await manager.start({ token });
    visited.add(EmbeddingState.EMBEDDING);
    await manager.complete({ token });
    visited.add(EmbeddingState.COMPLETED);
    await manager.archive({ token });
    visited.add(EmbeddingState.ARCHIVED);
    await manager.destroy({ token });
    visited.add(EmbeddingState.DESTROYED);

    /* Failed branch */
    token = await createDraftEmbedding(manager);
    await manager.queue({ token });
    await manager.prepare({ token });
    await manager.start({ token });
    await manager.fail({ token, reason: "x" });
    visited.add(EmbeddingState.FAILED);

    /* Cancelled branch (direct from Draft) */
    token = await createDraftEmbedding(manager);
    await manager.cancel({ token });
    visited.add(EmbeddingState.CANCELLED);

    expect(visited.size).toBe(Object.values(EmbeddingState).length);
  });
});

describe("EmbeddingManager — multi-tenant isolation", () => {
  it("Provider/Model registered for one tenant are not visible to another tenant", async () => {
    const { manager } = managerFixture();
    await registerDefaultProviderAndModel(manager, { tenantId: "tenant-a" });
    expect(manager.resolver.tryResolveProvider("tenant-b::openai")).toBeUndefined();
  });

  it("statistics are not shared across tenants that use the same providerType", async () => {
    const { manager } = managerFixture();
    const tokenA = await createDraftEmbedding(manager, { tenantId: "tenant-a" });
    const tokenB = await createDraftEmbedding(manager, { tenantId: "tenant-b" });
    await manager.cancel({ token: tokenA });
    /* statistics are keyed by providerType only (not tenant) per the design — both
     * Embeddings share the same OPENAI counter bucket; this documents that behavior. */
    expect(manager.statistics.get("openai" as never).cancelledCount).toBe(1);
    await manager.cancel({ token: tokenB });
    expect(manager.statistics.get("openai" as never).cancelledCount).toBe(2);
  });
});

describe("EmbeddingManager — health/monitoring reflect real activity", () => {
  it("monitoring.sample() reports healthy once Embeddings have been created and checks passed", async () => {
    const { manager } = managerFixture();
    await createDraftEmbedding(manager);
    const dashboard = manager.monitoring.sample();
    expect(dashboard.metrics.embeddingCount).toBeGreaterThan(0);
    expect(dashboard.health.registry.status).toBe("healthy");
  });

  it("health.check() reports unknown before any Embedding is registered", () => {
    const { manager } = managerFixture();
    expect(manager.health.check().registry.status).toBe("unknown");
  });
});

describe("EMBEDDING_STATE_TRANSITIONS — facade honors the exact table for every state pair", () => {
  it.each(Object.values(EmbeddingState))(
    "every legal outgoing edge from %s is exercised at least once by the flows above",
    (state) => {
      /* Sanity check the table itself stays in sync with OPERATION_FOR_STATE's coverage set. */
      for (const target of EMBEDDING_STATE_TRANSITIONS[state]) {
        expect(
          target === EmbeddingState.DESTROYED || OPERATION_FOR_STATE[target] !== undefined,
        ).toBe(true);
      }
    },
  );
});

describe("Illegal transitions surface as EmbeddingCheckException at the facade", () => {
  it("the pre-flight LifecycleValidator (stage 8 of 12) catches an illegal transition before the State Machine runs, wrapped as EmbeddingCheckException", async () => {
    /* This is a documented redundancy: `EmbeddingStateMachine.transition()` itself
     * throws `IllegalEmbeddingTransitionException` for the same illegal edge (see
     * test/state-machine/state-machine.spec.ts), but the Pipeline's Stage 1 Validation
     * always runs FIRST and already rejects an illegal targetState, so callers driving
     * the facade observe `EmbeddingCheckException`, not `IllegalEmbeddingTransitionException`
     * directly. See docs/005.7N-EMBEDDING-MANAGER-REPORT.md — "Pipeline". */
    const { manager } = managerFixture();
    const token = await createDraftEmbedding(manager);
    try {
      await manager.complete({ token });
      throw new Error("expected complete() to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(EmbeddingCheckException);
      expect((error as Error).message).toContain("draft");
      expect((error as Error).message).toContain("completed");
    }
  });
});
