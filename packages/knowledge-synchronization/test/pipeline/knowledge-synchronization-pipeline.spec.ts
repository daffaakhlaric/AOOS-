import { describe, expect, it } from "vitest";

import { KnowledgeConflictResolutionStrategy } from "../../src/domain/knowledge-conflict-resolution-strategy.js";
import { ConnectionValidationException } from "../../src/errors/connection-validation-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { SynchronizationPermissionDeniedException } from "../../src/errors/synchronization-permission-denied-exception.js";
import { SynchronizationPolicyViolationException } from "../../src/errors/synchronization-policy-violation-exception.js";
import { SynchronizationValidationException } from "../../src/errors/synchronization-validation-exception.js";
import { KnowledgeSynchronizationEventType } from "../../src/events/knowledge-synchronization-event-type.js";
import { KnowledgeSynchronizationEvents } from "../../src/events/knowledge-synchronization-events.js";
import { KnowledgeSynchronizationMetrics } from "../../src/metrics/knowledge-synchronization-metrics.js";
import { KnowledgeSynchronizationPipeline } from "../../src/pipeline/knowledge-synchronization-pipeline.js";
import { KnowledgeSynchronizationPolicy } from "../../src/policy/knowledge-synchronization-policy.js";
import { KnowledgeSynchronizationRegistryBucket } from "../../src/registry/knowledge-synchronization-registry-bucket.js";
import { KnowledgeSynchronizationRegistry } from "../../src/registry/knowledge-synchronization-registry.js";
import { KnowledgeSynchronizationResolver } from "../../src/resolver/knowledge-synchronization-resolver.js";
import { KnowledgeSynchronizationValidator } from "../../src/validator/knowledge-synchronization-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { jobFixture } from "../helpers/job-fixture.js";
import { providerFixture } from "../helpers/provider-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

function buildPipeline(
  options: {
    registry?: KnowledgeSynchronizationRegistry;
    permissionChecker?: { check: () => boolean | Promise<boolean> };
    committer?: { id: string; commit: (input: unknown) => Promise<void> };
    changeDetector?: { id: string; detect: () => Promise<readonly unknown[]> };
  } = {},
) {
  const registry = options.registry ?? new KnowledgeSynchronizationRegistry();
  const resolver = new KnowledgeSynchronizationResolver(registry, options.changeDetector as never);
  const policy = new KnowledgeSynchronizationPolicy(registry);
  const { publisher } = fakePublisher();
  const pipeline = new KnowledgeSynchronizationPipeline(
    new KnowledgeSynchronizationValidator(),
    policy,
    resolver,
    new KnowledgeSynchronizationMetrics(),
    new KnowledgeSynchronizationEvents(publisher),
    {
      permissionChecker: options.permissionChecker as never,
      committer: options.committer as never,
    },
  );
  return { pipeline, registry, policy };
}

describe("KnowledgeSynchronizationPipeline", () => {
  it("runs all 10 stages and returns detected changes", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const changes = [{ id: "c-1" }] as never;
    const { pipeline } = buildPipeline({
      registry,
      changeDetector: { id: "detector-1", detect: async () => changes },
    });
    const output = await pipeline.run({ job: jobFixture(), context: contextFixture() });
    expect(output.changes).toBe(changes);
  });

  it("throws SynchronizationValidationException for an invalid job", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry });
    await expect(
      pipeline.run({
        job: jobFixture({ providerId: "" }),
        context: contextFixture({ providerId: "" }),
      }),
    ).rejects.toThrow(SynchronizationValidationException);
  });

  it("publishes VALIDATION_FAILED when validation fails", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    const { publisher, publish } = fakePublisher();
    const resolver = new KnowledgeSynchronizationResolver(registry);
    const policy = new KnowledgeSynchronizationPolicy(registry);
    const pipeline = new KnowledgeSynchronizationPipeline(
      new KnowledgeSynchronizationValidator(),
      policy,
      resolver,
      new KnowledgeSynchronizationMetrics(),
      new KnowledgeSynchronizationEvents(publisher),
    );
    await expect(
      pipeline.run({
        job: jobFixture({ providerId: "" }),
        context: contextFixture({ providerId: "" }),
      }),
    ).rejects.toThrow();
    const call = publish.mock.calls.find(
      (c) => c[0].type === KnowledgeSynchronizationEventType.VALIDATION_FAILED,
    );
    expect(call).toBeDefined();
  });

  it("throws SynchronizationPolicyViolationException when a Policy denies the Job's mode", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const { pipeline, policy } = buildPipeline({ registry });
    policy.register({
      id: "p-1",
      name: "No manual",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedModes: ["manual" as never],
      createdAt: new Date().toISOString(),
    });
    await expect(pipeline.run({ job: jobFixture(), context: contextFixture() })).rejects.toThrow(
      SynchronizationPolicyViolationException,
    );
  });

  it("throws SynchronizationPermissionDeniedException when the permission checker rejects", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const { pipeline } = buildPipeline({ registry, permissionChecker: { check: () => false } });
    await expect(pipeline.run({ job: jobFixture(), context: contextFixture() })).rejects.toThrow(
      SynchronizationPermissionDeniedException,
    );
  });

  it("throws ProviderNotFoundException when the Provider is not registered", async () => {
    const { pipeline } = buildPipeline();
    await expect(pipeline.run({ job: jobFixture(), context: contextFixture() })).rejects.toThrow(
      ProviderNotFoundException,
    );
  });

  it("publishes PROVIDER_RESOLVED after resolving the Provider", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const { publisher, publish } = fakePublisher();
    const resolver = new KnowledgeSynchronizationResolver(registry);
    const policy = new KnowledgeSynchronizationPolicy(registry);
    const pipeline = new KnowledgeSynchronizationPipeline(
      new KnowledgeSynchronizationValidator(),
      policy,
      resolver,
      new KnowledgeSynchronizationMetrics(),
      new KnowledgeSynchronizationEvents(publisher),
    );
    await pipeline.run({ job: jobFixture(), context: contextFixture() });
    const call = publish.mock.calls.find(
      (c) => c[0].type === KnowledgeSynchronizationEventType.PROVIDER_RESOLVED,
    );
    expect(call).toBeDefined();
  });

  it("throws ConnectionValidationException when the Provider reports a failed connection", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(
      KnowledgeSynchronizationRegistryBucket.PROVIDER,
      providerFixture({ validateConnection: () => false }),
    );
    const { pipeline } = buildPipeline({ registry });
    await expect(pipeline.run({ job: jobFixture(), context: contextFixture() })).rejects.toThrow(
      ConnectionValidationException,
    );
  });

  it("passes Connection Validation when the Provider reports success", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(
      KnowledgeSynchronizationRegistryBucket.PROVIDER,
      providerFixture({ validateConnection: () => true }),
    );
    const { pipeline } = buildPipeline({ registry });
    const output = await pipeline.run({ job: jobFixture(), context: contextFixture() });
    expect(output.changes).toEqual([]);
  });

  it("dispatches Conflict Resolution when a strategy is requested", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const { pipeline, policy } = buildPipeline({ registry });
    const resolvedChanges = [{ id: "resolved" }] as never;
    policy.registerConflictResolver({
      id: "resolver-1",
      strategy: KnowledgeConflictResolutionStrategy.LAST_WRITE_WINS,
      resolve: async () => resolvedChanges,
    });
    const output = await pipeline.run({
      job: jobFixture(),
      context: contextFixture(),
      conflictStrategy: KnowledgeConflictResolutionStrategy.LAST_WRITE_WINS,
    });
    expect(output.changes).toBe(resolvedChanges);
  });

  it("calls the configured Committer with job/context/changes", async () => {
    const registry = new KnowledgeSynchronizationRegistry();
    registry.register(KnowledgeSynchronizationRegistryBucket.PROVIDER, providerFixture());
    const commit = async () => undefined;
    const committerSpy = { id: "committer-1", commit };
    let called: unknown;
    committerSpy.commit = async (input: unknown) => {
      called = input;
    };
    const { pipeline } = buildPipeline({ registry, committer: committerSpy });
    await pipeline.run({ job: jobFixture(), context: contextFixture() });
    expect(called).toBeDefined();
  });
});
