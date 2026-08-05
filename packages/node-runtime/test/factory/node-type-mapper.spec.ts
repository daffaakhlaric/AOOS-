import { NodeType as DefinitionNodeType } from "@aos/workflow-definition";
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { mapDefinitionNodeType } from "../../src/factory/node-type-mapper.js";

describe("mapDefinitionNodeType", () => {
  it("maps every @aos/workflow-definition NodeType to a Node Runtime NodeType", () => {
    for (const type of Object.values(DefinitionNodeType)) {
      expect(mapDefinitionNodeType(type)).toBeDefined();
    }
  });

  it("maps distinct types to their Node Runtime equivalent", () => {
    expect(mapDefinitionNodeType(DefinitionNodeType.START)).toBe(NodeType.START);
    expect(mapDefinitionNodeType(DefinitionNodeType.CAPABILITY)).toBe(NodeType.CAPABILITY);
    expect(mapDefinitionNodeType(DefinitionNodeType.DECISION)).toBe(NodeType.SWITCH);
    expect(mapDefinitionNodeType(DefinitionNodeType.PARALLEL)).toBe(NodeType.FORK);
  });

  it("maps TASK and SUB_WORKFLOW (no direct equivalent) onto CUSTOM", () => {
    expect(mapDefinitionNodeType(DefinitionNodeType.TASK)).toBe(NodeType.CUSTOM);
    expect(mapDefinitionNodeType(DefinitionNodeType.SUB_WORKFLOW)).toBe(NodeType.CUSTOM);
  });
});
