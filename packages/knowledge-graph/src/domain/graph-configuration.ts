import type { IGraphAuthorizationChecker } from "../contracts/i-graph-authorization-checker.js";

import type { KnowledgeEdgeType } from "./knowledge-edge-type.js";

/**
 * Package-wide configuration for a `KnowledgeGraphSystem`. All fields are optional at the API
 * boundary — `ConfigurationService` (see `src/configuration/`) fills in documented defaults.
 */
export interface GraphConfiguration {
  /** Authorization hook for the pipeline's Authorization stage. Defaults to permissive-allow-all. */
  readonly authorizationChecker?: IGraphAuthorizationChecker;
  /**
   * Edge types on which the Cycle Detection stage runs before an edge is committed. Defaults to
   * the hierarchical/DAG-shaped family: `DependsOn`, `ChildOf`, `ParentOf`, `Contains`.
   */
  readonly cycleCheckedEdgeTypes?: ReadonlySet<KnowledgeEdgeType>;
  /** When true (default), Relationship Validation failures throw instead of being ignored. */
  readonly strictRelationshipValidation?: boolean;
  /** Optional ceiling on BFS/DFS traversal depth. `undefined` means unbounded. */
  readonly maxTraversalDepth?: number;
}

/** Fully-resolved configuration after `ConfigurationService` applies defaults. */
export interface ResolvedGraphConfiguration {
  readonly authorizationChecker: IGraphAuthorizationChecker;
  readonly cycleCheckedEdgeTypes: ReadonlySet<KnowledgeEdgeType>;
  readonly strictRelationshipValidation: boolean;
  readonly maxTraversalDepth?: number;
}
