import { describe, expect, it } from "vitest";

import { NodeState } from "../../src/contracts/node-state.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { createNodeInstance } from "../../src/instance/create-node-instance.js";

describe("createNodeInstance", () => {
  it("creates a fresh Node Instance in CREATED state with a unique id", () => {
    const instance = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CAPABILITY,
    });
    expect(instance.status).toBe(NodeState.CREATED);
    expect(instance.workflowInstanceId).toBe("wf-1");
    expect(instance.nodeId).toBe("n-1");
    expect(instance.type).toBe(NodeType.CAPABILITY);
    expect(instance.id).toBeTruthy();
    expect(instance.config).toEqual({});
    expect(instance.metadata).toEqual({});
    expect(instance.createdAt).toBe(instance.updatedAt);
  });

  it("generates distinct ids per call", () => {
    const a = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    const b = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    expect(a.id).not.toBe(b.id);
  });

  it("carries through config, dependsOn, and metadata when supplied", () => {
    const instance = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CAPABILITY,
      config: { capabilityId: "crm.create" },
      dependsOn: ["n-0"],
      metadata: { owner: "team-x" },
    });
    expect(instance.config).toEqual({ capabilityId: "crm.create" });
    expect(instance.dependsOn).toEqual(["n-0"]);
    expect(instance.metadata).toEqual({ owner: "team-x" });
  });

  it("leaves dependsOn undefined when not supplied", () => {
    const instance = createNodeInstance({
      workflowInstanceId: "wf-1",
      nodeId: "n-1",
      type: NodeType.CUSTOM,
    });
    expect(instance.dependsOn).toBeUndefined();
  });
});
