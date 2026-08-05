import { describe, expect, it } from "vitest";

import { WorkflowExecutionSystem } from "../../src/bootstrap/workflow-execution-system.js";
import { successfulCapabilityExecutor } from "../helpers/capability-executor-fixture.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { nodeRuntimeFixture } from "../helpers/node-runtime-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { workflowRuntimeFixture } from "../helpers/workflow-runtime-fixture.js";

describe("Bootstrap Test — WorkflowExecutionSystem", () => {
  it("exposes name/version and wraps a working WorkflowExecutionEngine", async () => {
    const definition = definitionFixture();
    const { publisher } = fakePublisher();
    const system = new WorkflowExecutionSystem(
      publisher,
      workflowRuntimeFixture([definition]),
      nodeRuntimeFixture(),
      { capabilityExecutor: successfulCapabilityExecutor() },
    );

    expect(system.name).toBe("WorkflowExecutionSystemModule");
    expect(system.version).toBe("0.1.0");

    const result = await system.engine.executeWorkflow({ workflowId: definition.id });
    expect(result.success).toBe(true);
  });

  it("onBootstrap()/onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowExecutionSystem(
      publisher,
      workflowRuntimeFixture([]),
      nodeRuntimeFixture(),
    );

    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
