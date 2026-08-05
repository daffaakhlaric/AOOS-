import { describe, expect, it } from "vitest";

import { CapabilityAdapter } from "../../src/adapter/capability-adapter.js";
import { WorkflowIntegrationSystem } from "../../src/bootstrap/workflow-integration-system.js";
import { IntegrationNamespace } from "../../src/contracts/integration-namespace.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { successfulRuntime } from "../helpers/runtime-fixture.js";

describe("Bootstrap Test — WorkflowIntegrationSystem", () => {
  it("exposes name/version and wraps a working WorkflowIntegration", async () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowIntegrationSystem(publisher);

    expect(system.name).toBe("WorkflowIntegrationSystemModule");
    expect(system.version).toBe("0.1.0");

    system.integration.registerAdapter(new CapabilityAdapter("crm", successfulRuntime()));
    const outcome = await system.integration.integrate(
      IntegrationNamespace.CAPABILITY,
      { operation: "create", input: {} },
      contextFixture(),
    );
    expect(outcome.result.success).toBe(true);
  });

  it("accepts an optional WorkflowIntegrationConfig", () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowIntegrationSystem(publisher, { requireTenantId: true });
    expect(system.integration).toBeDefined();
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowIntegrationSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
