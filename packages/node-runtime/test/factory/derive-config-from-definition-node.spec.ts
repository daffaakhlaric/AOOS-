import { NodeType as DefinitionNodeType } from "@aos/workflow-definition";
import { describe, expect, it } from "vitest";

import { deriveConfigFromDefinitionNode } from "../../src/factory/derive-config-from-definition-node.js";

describe("deriveConfigFromDefinitionNode", () => {
  it("extracts capabilityId/capabilityVersion from a Capability Node", () => {
    expect(
      deriveConfigFromDefinitionNode({
        id: "n-1",
        name: "Cap",
        type: DefinitionNodeType.CAPABILITY,
        capability: "crm.create",
        capabilityVersion: "1.0.0",
      }),
    ).toEqual({ capabilityId: "crm.create", capabilityVersion: "1.0.0" });
  });

  it("extracts durationMs from a Delay Node", () => {
    expect(
      deriveConfigFromDefinitionNode({
        id: "n-1",
        name: "Delay",
        type: DefinitionNodeType.DELAY,
        durationMs: 5000,
      }),
    ).toEqual({ durationMs: 5000 });
  });

  it("extracts assigneeRole/formRef from a Human Node", () => {
    expect(
      deriveConfigFromDefinitionNode({
        id: "n-1",
        name: "Human",
        type: DefinitionNodeType.HUMAN,
        assigneeRole: "manager",
        formRef: "approval-form",
      }),
    ).toEqual({ assigneeRole: "manager", formRef: "approval-form" });
  });

  it("returns an empty config for Node Types with no direct mapping (e.g. Task)", () => {
    expect(
      deriveConfigFromDefinitionNode({ id: "n-1", name: "Task", type: DefinitionNodeType.TASK }),
    ).toEqual({});
  });
});
