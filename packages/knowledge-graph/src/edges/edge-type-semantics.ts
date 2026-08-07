import { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";

/**
 * Edge types whose graph shape must remain a DAG (no cycles). The Cycle Detection pipeline stage
 * runs before committing a new edge of one of these types. Chosen per the specification's own
 * examples ("DependsOn, ChildOf/ParentOf, Contains").
 */
export const HIERARCHICAL_EDGE_TYPES: ReadonlySet<KnowledgeEdgeType> = new Set([
  KnowledgeEdgeType.DependsOn,
  KnowledgeEdgeType.ChildOf,
  KnowledgeEdgeType.ParentOf,
  KnowledgeEdgeType.Contains,
]);

/**
 * Edge types that participate in dependency reasoning (`ReasoningManager`): dependency discovery
 * and impact analysis walk exactly this family.
 */
export const DEPENDENCY_EDGE_TYPES: ReadonlySet<KnowledgeEdgeType> = new Set([
  KnowledgeEdgeType.DependsOn,
  KnowledgeEdgeType.Uses,
  KnowledgeEdgeType.Calls,
  KnowledgeEdgeType.References,
]);

/**
 * Logically-inverse edge type pairs. `ChildOf` and `ParentOf` describe the same relationship from
 * opposite ends — Relationship Validation rejects an edge that would contradict an existing
 * inverse edge already recorded between the same node pair in the same direction.
 */
export const INVERSE_EDGE_TYPE_PAIRS: ReadonlyMap<KnowledgeEdgeType, KnowledgeEdgeType> = new Map([
  [KnowledgeEdgeType.ChildOf, KnowledgeEdgeType.ParentOf],
  [KnowledgeEdgeType.ParentOf, KnowledgeEdgeType.ChildOf],
]);

/**
 * Edge types restricted to at most one outgoing edge of that type per source node ("single
 * target" cardinality) — e.g. a node is a version of at most one other node.
 */
export const SINGLE_TARGET_EDGE_TYPES: ReadonlySet<KnowledgeEdgeType> = new Set([
  KnowledgeEdgeType.VersionOf,
  KnowledgeEdgeType.DuplicateOf,
  KnowledgeEdgeType.DerivedFrom,
]);
