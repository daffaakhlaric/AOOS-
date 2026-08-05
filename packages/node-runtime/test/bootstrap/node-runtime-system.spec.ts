import { describe, expect, it } from "vitest";

import { NodeRuntimeSystem } from "../../src/bootstrap/node-runtime-system.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { fakePublisher } from "../helpers/publisher-fixture.js";

describe("Bootstrap Test — NodeRuntimeSystem (IModule)", () => {
  it("exposes name/version and a ready-to-use runtime", async () => {
    const { publisher } = fakePublisher();
    const system = new NodeRuntimeSystem(publisher);
    expect(system.name).toBe("NodeRuntimeSystemModule");
    expect(system.version).toBe("0.1.0");
    const execution = await system.runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    expect(execution.instance.type).toBe(NodeType.CUSTOM);
  });

  it("accepts an optional NodeRuntimeConfig", async () => {
    const { publisher } = fakePublisher();
    const system = new NodeRuntimeSystem(publisher, { defaultExecutionMode: undefined });
    const execution = await system.runtime.createFromRegistry({
      workflowInstanceId: "wf-inst-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    expect(execution).toBeDefined();
  });

  it("onBootstrap() and onShutdown() resolve without error", async () => {
    const { publisher } = fakePublisher();
    const system = new NodeRuntimeSystem(publisher);
    await expect(system.onBootstrap()).resolves.toBeUndefined();
    await expect(system.onShutdown()).resolves.toBeUndefined();
  });
});
