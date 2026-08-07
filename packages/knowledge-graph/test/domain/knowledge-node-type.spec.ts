import { describe, expect, it } from "vitest";

import { isKnowledgeNodeType, KnowledgeNodeType } from "../../src/domain/knowledge-node-type.js";

const EXPECTED_TYPES = [
  "Knowledge",
  "Document",
  "Chunk",
  "Embedding",
  "Memory",
  "Prompt",
  "Agent",
  "Workflow",
  "Capability",
  "Tool",
  "Connector",
  "Organization",
  "Department",
  "Role",
  "Employee",
  "BusinessProcess",
  "SolutionPack",
  "Custom",
];

describe("KnowledgeNodeType", () => {
  it("has exactly the 18 catalogued node types", () => {
    expect(Object.values(KnowledgeNodeType)).toHaveLength(18);
    expect(Object.values(KnowledgeNodeType).sort()).toEqual([...EXPECTED_TYPES].sort());
  });

  it.each(EXPECTED_TYPES)("recognizes %s as a valid node type", (type) => {
    expect(isKnowledgeNodeType(type)).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isKnowledgeNodeType("NotAType")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgeNodeType(42)).toBe(false);
    expect(isKnowledgeNodeType(null)).toBe(false);
    expect(isKnowledgeNodeType(undefined)).toBe(false);
    expect(isKnowledgeNodeType({})).toBe(false);
  });
});
