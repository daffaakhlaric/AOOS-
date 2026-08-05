import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";
import { SynchronizationNotFoundException } from "../../src/errors/synchronization-not-found-exception.js";
import { SynchronizationValidationException } from "../../src/errors/synchronization-validation-exception.js";
import { KnowledgeSynchronizationEvents } from "../../src/events/knowledge-synchronization-events.js";
import { KnowledgeSynchronization } from "../../src/synchronization/knowledge-synchronization.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { engineFixture } from "../helpers/engine-fixture.js";
import { jobFixture } from "../helpers/job-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

async function synchronizationFixture() {
  const { engine, indexing, retrieval } = await engineFixture();
  const { publisher } = fakePublisher();
  const synchronization = new KnowledgeSynchronization({
    knowledgeEngine: engine,
    knowledgeIndexing: indexing,
    knowledgeRetrieval: retrieval,
    events: new KnowledgeSynchronizationEvents(publisher),
  });
  return { synchronization, engine, indexing, retrieval };
}

describe("KnowledgeSynchronization", () => {
  it("holds read-only references to the platform layers it bridges", async () => {
    const { synchronization, engine, indexing, retrieval } = await synchronizationFixture();
    expect(synchronization.knowledgeEngine).toBe(engine);
    expect(synchronization.knowledgeIndexing).toBe(indexing);
    expect(synchronization.knowledgeRetrieval).toBe(retrieval);
  });

  it("registerProvider() registers a Provider that synchronize() can then resolve", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    const execution = await synchronization.synchronize(jobFixture(), contextFixture());
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.COMPLETED);
  });

  it("synchronize() rejects an invalid Job", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    await expect(
      synchronization.synchronize(
        jobFixture({ providerId: "" }),
        contextFixture({ providerId: "" }),
      ),
    ).rejects.toThrow(SynchronizationValidationException);
  });

  it("registerPolicy() wires a Policy that can deny a Job's mode", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    synchronization.registerPolicy({
      id: "policy-1",
      name: "No manual",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedModes: ["manual" as never],
      createdAt: new Date().toISOString(),
    });
    await expect(synchronization.synchronize(jobFixture(), contextFixture())).rejects.toThrow();
  });

  it("registerConflictResolver() wires a resolver the Policy can dispatch to", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    expect(synchronization.policy.isConflictResolutionSupported("last_write_wins" as never)).toBe(
      false,
    );
    synchronization.registerConflictResolver({
      id: "resolver-1",
      strategy: "last_write_wins" as never,
      resolve: async (changes) => changes,
    });
    expect(synchronization.policy.isConflictResolutionSupported("last_write_wins" as never)).toBe(
      true,
    );
  });

  it("use() registers custom Middleware that runs after synchronize()", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    let ran = false;
    synchronization.use((_execution, next) => {
      ran = true;
      return next();
    });
    await synchronization.synchronize(jobFixture(), contextFixture());
    expect(ran).toBe(true);
  });

  it("getExecution()/requireExecution() look up a completed Synchronization by token", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    const context = contextFixture();
    const execution = await synchronization.synchronize(jobFixture(), context);
    expect(synchronization.getExecution(execution.instance.token)).toBe(execution);
    expect(synchronization.requireExecution(execution.instance.token)).toBe(execution);
  });

  it("requireExecution() throws for an unknown token", async () => {
    const { synchronization } = await synchronizationFixture();
    expect(() => synchronization.requireExecution("missing")).toThrow(
      SynchronizationNotFoundException,
    );
  });

  it("destroy() delegates to the Synchronizer", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    const context = contextFixture();
    const execution = await synchronization.synchronize(jobFixture(), context);
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.COMPLETED);
    const destroyed = await synchronization.destroy(context.token);
    expect(destroyed.instance.state).toBe(KnowledgeSynchronizationState.DESTROYED);
  });

  it("cancel() delegates to the Synchronizer", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    const context = contextFixture();
    // Register a still-open execution directly so cancel() has something legal to cancel.
    synchronization.manager.register({
      instance: {
        id: "i-1",
        token: context.token,
        jobId: "job-1",
        providerId: "provider-1",
        tenantId: context.tenantId,
        state: KnowledgeSynchronizationState.CREATED,
        retryCount: 0,
        changeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      context,
      job: jobFixture(),
      changes: [],
      history: [],
    });
    const cancelled = await synchronization.cancel(context.token);
    expect(cancelled.instance.state).toBe(KnowledgeSynchronizationState.CANCELLED);
  });

  it("retry() delegates to the Synchronizer", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    const context = contextFixture();
    await expect(
      synchronization.synchronize(jobFixture({ providerId: "" }), { ...context, providerId: "" }),
    ).rejects.toThrow();
    await expect(synchronization.retry(context.token)).rejects.toThrow();
  });

  it("health()/metrics()/monitorSnapshot() report live state after a synchronize()", async () => {
    const { synchronization } = await synchronizationFixture();
    synchronization.registerProvider(providerFixture());
    await synchronization.synchronize(jobFixture(), contextFixture());
    expect(synchronization.health().status).toBeDefined();
    expect(synchronization.metrics().synchronizationCount).toBe(1);
    expect(synchronization.monitorSnapshot().synchronization.total).toBe(1);
  });
});
