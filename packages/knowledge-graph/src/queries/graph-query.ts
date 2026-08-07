import type { KnowledgeEdgeType } from "../domain/knowledge-edge-type.js";
import type { KnowledgeNodeType } from "../domain/knowledge-node-type.js";

export interface FilterQuery {
  readonly kind: "Filter";
  readonly nodeType?: KnowledgeNodeType;
  readonly edgeType?: KnowledgeEdgeType;
}

export interface SearchQuery {
  readonly kind: "Search";
  readonly text: string;
}

export interface TraversalQueryInput {
  readonly kind: "TraversalQuery";
  readonly algorithm: "bfs" | "dfs";
  readonly startNodeId: string;
  readonly edgeTypes?: readonly KnowledgeEdgeType[];
  readonly maxDepth?: number;
}

export interface PathQueryInput {
  readonly kind: "PathQuery";
  readonly startNodeId: string;
  readonly endNodeId: string;
}

export interface RelationshipQueryInput {
  readonly kind: "RelationshipQuery";
  readonly nodeId?: string;
  readonly edgeType?: KnowledgeEdgeType;
}

export interface DependencyQueryInput {
  readonly kind: "DependencyQuery";
  readonly nodeId: string;
  readonly direction: "dependencies" | "dependents";
}

export interface AnalyticsQueryInput {
  readonly kind: "AnalyticsQuery";
  readonly metric: "statistics" | "connectedComponents" | "cycles" | "averageDegree";
}

/** The 7 Graph Query kinds from the specification, modeled as a discriminated union on `kind`. */
export type GraphQuery =
  | FilterQuery
  | SearchQuery
  | TraversalQueryInput
  | PathQueryInput
  | RelationshipQueryInput
  | DependencyQueryInput
  | AnalyticsQueryInput;
