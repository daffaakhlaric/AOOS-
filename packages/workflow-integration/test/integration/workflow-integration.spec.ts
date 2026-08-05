import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { WorkflowIntegrationEventPublisher } from "../../src/events/workflow-integration-event-publisher.js";
import { WorkflowIntegrationEventType } from "../../src/events/workflow-integration-event-type.js";
import { WorkflowIntegration } from "../../src/integration/workflow-integration.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { failingRuntime, successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Integration Test — WorkflowIntegration", () => {
  it("registerAdapter() then integrate() resolves and executes the Adapter, publishing STARTED/COMPLETED", async () => {
    const { publisher, publish } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime({ id: "1" })));

    const outcome = await integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result).toEqual({ success: true, output: { id: "1" } });
    const publishedTypes = publish.mock.calls.map((call) => call[0]?.type);
    expect(publishedTypes).toContain(WorkflowIntegrationEventType.STARTED);
    expect(publishedTypes).toContain(WorkflowIntegrationEventType.COMPLETED);
  });

  it("publishes FAILED and records a failure metric when the Adapter's result is unsuccessful", async () => {
    const { publisher, publish } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", failingRuntime("boom")));

    const outcome = await integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result.success).toBe(false);
    expect(integration.metrics().failures).toBe(1);
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      WorkflowIntegrationEventType.FAILED,
    );
  });

  it("publishes VALIDATION_FAILED and rethrows when the Registry fails validation", async () => {
    const { publisher, publish } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm"));

    await expect(
      integration.integrate(
        IntegrationNamespace.CAPABILITY,
        { operation: "create", input: {} },
        contextFixture(),
      ),
    ).rejects.toThrow();
    expect(publish.mock.calls.map((call) => call[0]?.type)).toContain(
      WorkflowIntegrationEventType.VALIDATION_FAILED,
    );
  });

  it("replaceAdapter() swaps the Adapter used for future integrate() calls", async () => {
    const { publisher } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", failingRuntime("old")));
    integration.replaceAdapter(new CapabilityAdapter("crm", successfulRuntime({ id: "new" })));

    const outcome = await integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(outcome.result).toEqual({ success: true, output: { id: "new" } });
  });

  it("removeAdapter() removes a registered Adapter", () => {
    const { publisher } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));
    expect(integration.removeAdapter(IntegrationNamespace.CAPABILITY, "crm")).toBe(true);
    expect(integration.registry.list(IntegrationNamespace.CAPABILITY)).toHaveLength(0);
  });

  it("resolveChain() delegates to the Resolver without executing anything", () => {
    const { publisher } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));
    const chain = integration.resolveChain();
    expect(chain.get(IntegrationNamespace.CAPABILITY)?.name).toBe("crm");
  });

  it("use() registers an extra Middleware", async () => {
    const { publisher } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));
    const seen: string[] = [];
    integration.use({
      name: "recorder",
      async execute(mwContext, next) {
        seen.push(mwContext.namespace);
        await next();
      },
    });

    await integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(seen).toEqual([IntegrationNamespace.CAPABILITY]);
  });

  it("health()/metrics()/monitorSnapshot() reflect the current state", async () => {
    const { publisher } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));

    await integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );

    expect(integration.health().status).toBe("healthy");
    expect(integration.metrics().completed).toBe(1);
    expect(integration.monitorSnapshot().metrics.completed).toBe(1);
  });

  it("publishes FAILED (not VALIDATION_FAILED) and rethrows for a non-validation thrown error", async () => {
    const { publisher, publish } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
      config: { permissionChecker: { check: () => false } },
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));

    await expect(
      integration.integrate(
        IntegrationNamespace.CAPABILITY,
        { operation: "create", input: {} },
        contextFixture(),
      ),
    ).rejects.toThrow();

    const publishedTypes = publish.mock.calls.map((call) => call[0]?.type);
    expect(publishedTypes).toContain(WorkflowIntegrationEventType.FAILED);
    expect(publishedTypes).not.toContain(WorkflowIntegrationEventType.VALIDATION_FAILED);
  });

  it("serializes a non-Error thrown value into the FAILED event payload", async () => {
    const { publisher, publish } = fakePublisher();
    const integration = new WorkflowIntegration({
      eventPublisher: new WorkflowIntegrationEventPublisher(publisher),
    });
    integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));
    integration.use({
      name: "throws-non-error",
      async execute() {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "a plain string failure";
      },
    });

    await expect(
      integration.integrate(
        IntegrationNamespace.CAPABILITY,
        { operation: "create", input: {} },
        contextFixture(),
      ),
    ).rejects.toBe("a plain string failure");

    const failedCall = publish.mock.calls.find(
      (call) => call[0]?.type === WorkflowIntegrationEventType.FAILED,
    );
    expect(failedCall?.[0]?.payload).toMatchObject({ error: "a plain string failure" });
  });
});
