import { describe, expect, it } from "vitest";

import { isKnowledgeEdgeType, KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";

const EXPECTED_TYPES = [
  "DependsOn",
  "Uses",
  "Calls",
  "References",
  "Generates",
  "Consumes",
  "Owns",
  "Contains",
  "Extends",
  "Implements",
  "RelatedTo",
  "ChildOf",
  "ParentOf",
  "DuplicateOf",
  "DerivedFrom",
  "VersionOf",
  "BelongsTo",
  "AssignedTo",
  "ManagedBy",
  "Custom",
];

describe("KnowledgeEdgeType", () => {
  it("has exactly the 20 catalogued edge types", () => {
    expect(Object.values(KnowledgeEdgeType)).toHaveLength(20);
    expect(Object.values(KnowledgeEdgeType).sort()).toEqual([...EXPECTED_TYPES].sort());
  });

  it.each(EXPECTED_TYPES)("recognizes %s as a valid edge type", (type) => {
    expect(isKnowledgeEdgeType(type)).toBe(true);
  });

  it("rejects unknown strings", () => {
    expect(isKnowledgeEdgeType("NotAType")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isKnowledgeEdgeType(42)).toBe(false);
    expect(isKnowledgeEdgeType(null)).toBe(false);
    expect(isKnowledgeEdgeType(undefined)).toBe(false);
    expect(isKnowledgeEdgeType({})).toBe(false);
  });
});
