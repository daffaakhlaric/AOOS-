/** An ordered path through a `KnowledgeGraph`, e.g. the result of a shortest-path query. */
export interface GraphPath {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  /** Number of edges traversed (`nodeIds.length - 1`), i.e. the path's unweighted length. */
  readonly length: number;
}
