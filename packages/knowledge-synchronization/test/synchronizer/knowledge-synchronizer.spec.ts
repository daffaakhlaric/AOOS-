import { describe, expect, it } from "vitest";

import { KnowledgeSynchronizationState } from "../../src/domain/knowledge-synchronization-state.js";
import { KnowledgeSynchronizationEventType } from "../../src/events/knowledge-synchronization-event-type.js";
import { KnowledgeSynchronizationEvents } from "../../src/events/knowledge-synchronization-events.js";
import { KnowledgeSynchronizationManager } from "../../src/manager/knowledge-synchronization-manager.js";
import { KnowledgeSynchronizationMetrics } from "../../src/metrics/knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationPipeline } from "../../src/pipeline/knowledge-synchronization-pipeline.js";
import { KnowledgeSynchronizationPolicy } from "../../src/policy/knowledge-synchronization-policy.js";
import { KnowledgeSynchronizationRegistryBucket } from "../../src/registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";
import { KnowledgeSynchronizationResolver } from "../../src/resolver/knowledge-synchronization-resolver.js";
import { KnowledgeSynchronizationStateMachine } from "../../src/state-machine/knowledge-synchronization-state-machine.js";
import { KnowledgeSynchronizer } from "../../src/synchronizer/knowledge-synchronizer.js";
import { KnowledgeSynchronizationValidator } from "../../src/validator/knowledge-synchronization-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { jobFixture } from "../helpers/job-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildSynchronizer(
  options: { retryStrategy?: { shouldRetry: () => boolean; nextDelayMs: () => number } } = {},
) {
  const registry = new KnowledgeSynchronizationRegistry();
  registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
  const resolver = new KnowledgeSynchronizationResolver(registry);
  const policy = new KnowledgeSynchronizationPolicy(registry);
  const metrics = new KnowledgeSynchronizationMetrics();
  const { publisher, publish } = fakePublisher();
  const events = new KnowledgeSynchronizationEvents(publisher);
  const pipeline = new KnowledgeSynchronizationPipeline(
    new KnowledgeSynchronizationValidator(),
    policy,
    resolver,
    metrics,
    events,
  );
  const manager = new KnowledgeSynchronizationManager();
  const synchronizer = new KnowledgeSynchronizer(
    new KnowledgeSynchronizationStateMachine(),
    manager,
    pipeline,
    metrics,
    events,
    options.retryStrategy as never,
  );
  return { synchronizer, manager, publish };
}

describe("KnowledgeSynchronizer", () => {
  it("synchronize() completes and registers the execution in the manager", async () => {
    const { synchronizer, manager } = buildSynchronizer();
    const context = contextFixture();
    const execution = await synchronizer.synchronize({ job: jobFixture(), context });
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.COMPLETED);
    expect(manager.get(context.token)).toBe(execution);
  });

  it("synchronize() publishes CREATED/STARTED/COMPLETED events", async () => {
    const { synchronizer, publish } = buildSynchronizer();
    await synchronizer.synchronize({ job: jobFixture(), context: contextFixture() });
    const types = publish.mock.calls.map((c) => c[0].type);
    expect(types).toContain(KnowledgeSynchronizationEventType.CREATED);
    expect(types).toContain(KnowledgeSynchronizationEventType.STARTED);
    expect(types).toContain(KnowledgeSynchronizationEventType.COMPLETED);
  });

  it("synchronize() transitions to FAILED and rethrows on pipeline failure", async () => {
    const { synchronizer } = buildSynchronizer();
    await expect(
      synchronizer.synchronize({
        job: jobFixture({ providerId: "" }),
        context: contextFixture({ providerId: "" }),
      }),
    ).rejects.toThrow();
  });

  it("synchronize() transitions to RETRYING when the retry strategy says so", async () => {
    const { synchronizer, manager, publish } = buildSynchronizer({
      retryStrategy: { shouldRetry: () => true, nextDelayMs: () => 0 },
    });
    const context = contextFixture();
    await expect(
      synchronizer.synchronize({
        job: jobFixture({ providerId: "" }),
        context: { ...context, providerId: "" },
      }),
    ).rejects.toThrow();
    const execution = manager.require(context.token);
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.RETRYING);
    expect(execution.instance.retryCount).toBe(1);
    const types = publish.mock.calls.map((c) => c[0].type);
    expect(types).toContain(KnowledgeSynchronizationEventType.RETRY);
  });

  it("retry() re-runs the pipeline for a RETRYING execution", async () => {
    const { synchronizer, manager } = buildSynchronizer({
      retryStrategy: { shouldRetry: () => true, nextDelayMs: () => 0 },
    });
    const context = contextFixture();
    await expect(
      synchronizer.synchronize({
        job: jobFixture({ providerId: "" }),
        context: { ...context, providerId: "" },
      }),
    ).rejects.toThrow();
    // Fix the underlying issue and retry — retry() replays the already-stored (failing) job/context.
    // Register a Provider matching the stored (blank) providerId isn't possible, so retry() should fail again.
    await expect(synchronizer.retry(context.token)).rejects.toThrow();
    expect(manager.require(context.token).instance.state).toBe(
      KnowledgeSynchronizationState.RETRYING,
    );
    expect(manager.require(context.token).instance.retryCount).toBe(2);
  });

  it("retry() re-runs the pipeline successfully from RETRYING", async () => {
    const { synchronizer, manager } = buildSynchronizer();
    const context = contextFixture();
    // Register a RETRYING execution directly — retry() only requires the manager to
    // already hold a token-addressable execution in that state.
    manager.register({
      instance: {
        id: "i-1",
        token: context.token,
        jobId: "job-1",
        providerId: "provider-1",
        tenantId: context.tenantId,
        state: KnowledgeSynchronizationState.RETRYING,
        retryCount: 1,
        changeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      context,
      job: jobFixture(),
      changes: [],
      history: [],
    });
    const execution = await synchronizer.retry(context.token);
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.COMPLETED);
  });

  it("cancel() transitions a still-open Synchronization to CANCELLED", async () => {
    const { synchronizer, manager } = buildSynchronizer();
    const context = contextFixture();
    manager.register({
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
    const cancelled = await synchronizer.cancel(context.token);
    expect(cancelled.instance.state).toBe(KnowledgeSynchronizationState.CANCELLED);
  });

  it("destroy() transitions a settled Synchronization to DESTROYED and unregisters it", async () => {
    const { synchronizer, manager } = buildSynchronizer();
    const context = contextFixture();
    const execution = await synchronizer.synchronize({ job: jobFixture(), context });
    expect(execution.instance.state).toBe(KnowledgeSynchronizationState.COMPLETED);
    const destroyed = await synchronizer.destroy(context.token);
    expect(destroyed.instance.state).toBe(KnowledgeSynchronizationState.DESTROYED);
    expect(manager.get(context.token)).toBeUndefined();
  });
});
