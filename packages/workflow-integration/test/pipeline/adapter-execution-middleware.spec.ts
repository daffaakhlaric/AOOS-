import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationEventPublisher } from "../../src/events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationEventType } from "../../src/events/workflow-integration-event-type.js";
import { WorkflowIntegrationMetrics } from "../../src/metrics/workflow-integration-metrics.js";
import { AdapterExecutionMiddleware } from "../../src/pipeline/adapter-execution-middleware.js";
import { WorkflowIntegrationRegistry } from "../../src/registry/workflow-integration-registry.js";
import { WorkflowIntegrationResolver } from "../../src/resolver/workflow-integration-resolver.js";
import { middlewareContextFixture } from "../helpers/middleware-context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { failingRuntime, successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Pipeline Test — AdapterExecutionMiddleware", () => {
  it("resolves the Adapter, calls execute(), and sets mwContext.result on success", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", successfulRuntime({ id: "1" })));
    const resolver = new WorkflowIntegrationResolver(registry);
    const metrics = new WorkflowIntegrationMetrics();
    const { publisher, publish } = fakePublisher();
    const middleware = new AdapterExecutionMiddleware(
      resolver,
      metrics,
      new WorkflowIntegrationEventPublisher(publisher),
    );

    const mwContext = middlewareContextFixture();
    await middleware.execute(mwContext, async () => {});

    expect(mwContext.result).toEqual({ success: true, output: { id: "1" } });
    expect(metrics.snapshot().adapterUsage).toEqual({ crm: 1 });
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      WorkflowIntegrationEventType.ADAPTER_RESOLVED,
    );
  });

  it("sets a business-failure result when no Adapter is registered for the namespace", async () => {
    const registry = new WorkflowIntegrationRegistry();
    const resolver = new WorkflowIntegrationResolver(registry);
    const metrics = new WorkflowIntegrationMetrics();
    const { publisher } = fakePublisher();
    const middleware = new AdapterExecutionMiddleware(
      resolver,
      metrics,
      new WorkflowIntegrationEventPublisher(publisher),
    );

    const mwContext = middlewareContextFixture();
    await middleware.execute(mwContext, async () => {});

    expect(mwContext.result?.success).toBe(false);
    expect(mwContext.result?.error).toContain("No Adapter is registered");
  });

  it("propagates a failing Adapter's result unchanged", async () => {
    const registry = new WorkflowIntegrationRegistry();
    registry.register(new CapabilityAdapter("crm", failingRuntime("boom")));
    const resolver = new WorkflowIntegrationResolver(registry);
    const metrics = new WorkflowIntegrationMetrics();
    const { publisher } = fakePublisher();
    const middleware = new AdapterExecutionMiddleware(
      resolver,
      metrics,
      new WorkflowIntegrationEventPublisher(publisher),
    );

    const mwContext = middlewareContextFixture();
    await middleware.execute(mwContext, async () => {});

    expect(mwContext.result).toEqual({ success: false, error: "boom" });
  });

  it("rethrows a non-AdapterNotFoundException error raised while resolving the Adapter", async () => {
    const brokenResolver = {
      resolve: () => {
        throw new Error("resolver exploded");
      },
    } as unknown as WorkflowIntegrationResolver;
    const metrics = new WorkflowIntegrationMetrics();
    const { publisher } = fakePublisher();
    const middleware = new AdapterExecutionMiddleware(
      brokenResolver,
      metrics,
      new WorkflowIntegrationEventPublisher(publisher),
    );

    await expect(middleware.execute(middlewareContextFixture(), async () => {})).rejects.toThrow(
      "resolver exploded",
    );
  });
});
