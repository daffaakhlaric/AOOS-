import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { WorkflowIntegrationEventPublisher } from "../../src/events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { WorkflowIntegrationPipeline } from "../../src/pipeline/workflow-integration-pipeline.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { WorkflowIntegrationResolver } from "../../src/resolver/workflow-integration-resolver.js";
import { RetryStrategy } from "../../src/retry/retry-policy.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { failingRuntime, successfulRuntime } from "../helpers/runtime-fixture.js";

function buildPipeline(
  registry: WorkflowIntegrationRegistry,
  config?: ConstructorParameters<typeof WorkflowIntegrationPipeline>[0]["config"],
) {
  const { publisher } = fakePublisher();
  const metrics = new WorkflowIntegrationMetrics();
  return new WorkflowIntegrationPipeline({
    registry,
    resolver: new WorkflowIntegrationResolver(registry),
    metrics,
    eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    config,
  });
}

describe("Pipeline Test — WorkflowIntegrationPipeline", () => {
  it("integrate() resolves the Adapter and returns a successful result", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime({ id: "1" })));
    const pipeline = buildPipeline(registry);

    const outcome = await pipeline.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result).toEqual({ success: true, output: { id: "1" } });
    expect(outcome.context.capabilityResult).toEqual(outcome.result);
  });

  it("integrate() returns a business failure when no Adapter is registered", async () => {
    const registry = new WorkflowIntegrationRegistry();
    const pipeline = buildPipeline(registry);

    const outcome = await pipeline.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result.success).toBe(false);
  });

  it("integrate() throws when the Registry fails validation (unavailable Adapter)", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm"));
    const pipeline = buildPipeline(registry);

    await expect(
      pipeline.integrate(
        IntegrationNamespace.CAPABILITY,
        { operation: "create", input: {} },
        contextFixture(),
      ),
    ).rejects.toThrow();
  });

  it("integrate() retries a failing Adapter according to the configured RetryPolicy", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", failingRuntime("boom")));
    const pipeline = buildPipeline(registry, {
      retryPolicy: { strategy: RetryStrategy.IMMEDIATE, maxAttempts: 1 },
    });

    const outcome = await pipeline.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result.success).toBe(false);
  });

  it("use() registers an extra Middleware that runs before the terminal stage", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const pipeline = buildPipeline(registry);
    const seenNamespaces: IntegrationNamespace[] = [];

    pipeline.use({
      name: "recorder",
      async execute(mwContext, next) {
        seenNamespaces.push(mwContext.namespace);
        await next();
      },
    });

    await pipeline.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(seenNamespaces).toEqual([IntegrationNamespace.CAPABILITY]);
  });

  it("integrate() falls back to a business-failure result when a short-circuiting Middleware never reaches the terminal stage", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime()));
    const pipeline = buildPipeline(registry);

    pipeline.use({
      name: "short-circuit",
      async execute() {
        // deliberately never calls next() — the terminal AdapterExecutionMiddleware never runs.
      },
    });

    const outcome = await pipeline.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result.success).toBe(false);
    expect(outcome.result.error).toContain("No result was produced");
  });
});
