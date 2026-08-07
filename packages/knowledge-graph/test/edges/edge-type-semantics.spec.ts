import { describe, expect, it } from "vitest";

import { KnowledgeEdgeType } from "../../src/domain/knowledge-edge-type.js";
import {
  DEPENDENCY_EDGE_TYPES,
  HIERARCHICAL_EDGE_TYPES,
  INVERSE_EDGE_TYPE_PAIRS,
  SINGLE_TARGET_EDGE_TYPES,
} from "../../src/edges/edge-type-semantics.js";

describe("edge-type-semantics", () => {
  it("HIERARCHICAL_EDGE_TYPES contains exactly the DAG-shaped family", () => {
    expect(HIERARCHICAL_EDGE_TYPES).toEqual(
      new Set([
        KnowledgeEdgeType.DependsOn,
        KnowledgeEdgeType.ChildOf,
        KnowledgeEdgeType.ParentOf,
        KnowledgeEdgeType.Contains,
      ]),
    );
  });

  it("DEPENDENCY_EDGE_TYPES contains exactly the reasoning family", () => {
    expect(DEPENDENCY_EDGE_TYPES).toEqual(
      new Set([
        KnowledgeEdgeType.DependsOn,
        KnowledgeEdgeType.Uses,
        KnowledgeEdgeType.Calls,
        KnowledgeEdgeType.References,
      ]),
    );
  });

  it("INVERSE_EDGE_TYPE_PAIRS maps ChildOf <-> ParentOf both ways", () => {
    expect(INVERSE_EDGE_TYPE_PAIRS.get(KnowledgeEdgeType.ChildOf)).toBe(KnowledgeEdgeType.ParentOf);
    expect(INVERSE_EDGE_TYPE_PAIRS.get(KnowledgeEdgeType.ParentOf)).toBe(KnowledgeEdgeType.ChildOf);
  });

  it("SINGLE_TARGET_EDGE_TYPES contains VersionOf/DuplicateOf/DerivedFrom", () => {
    expect(SINGLE_TARGET_EDGE_TYPES).toEqual(
      new Set([
        KnowledgeEdgeType.VersionOf,
        KnowledgeEdgeType.DuplicateOf,
        KnowledgeEdgeType.DerivedFrom,
      ]),
    );
  });
});
