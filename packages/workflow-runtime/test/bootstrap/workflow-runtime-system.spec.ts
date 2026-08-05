import { describe, expect, it } from "vitest";

import { WorkflowRuntimeSystem } from "../../src/bootstrap/workflow-runtime-system.js";
import { definitionFixture } from "../helpers/definition-fixture.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";
import { registryFixture } from "../helpers/registry-fixture.js";

describe("Bootstrap Test — WorkflowRuntimeSystem (IModule)", () => {
  it("exposes name/version and a ready-to-use runtime", async () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowRuntimeSystem(publisher, registryFixture([definitionFixture()]));
    expect(system.name).toBe("WorkflowRuntimeSystemModule");
    expect(system.version).toBe("0.1.0");
    const execution = await system.runtime.createInstance({ workflowId: "sample-workflow" });
    expect(execution.instance.workflowId).toBe("sample-workflow");
  });

  it("accepts an optional WorkflowRuntimeConfig", async () => {
    const { publisher } = fakePublisher();
    const replayProvider = { replayInstance: async () => [] };
    const system = new WorkflowRuntimeSystem(publisher, registryFixture([definitionFixture()]), {
      replayProvider,
    });
    const execution = await system.runtime.createInstance({ workflowId: "sample-workflow" });
    await expect(system.runtime.replay(execution.instance.token)).resolves.toEqual([]);
  });

  it("onBootstrap() and onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new WorkflowRuntimeSystem(publisher, registryFixture([definitionFixture()]));
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
