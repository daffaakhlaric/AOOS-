import type { KnowledgeRelationship } from "../domain/knowledge-relationship.js";

/** "IKnowledgeGraph — No implementation." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md — "AI READY: Knowledge Graph"). A future graph-analytics layer over `relationship/knowledge-relationship-engine.ts`'s adjacency data — this package builds the graph edges but performs no graph analytics (centrality, community detection, ...) itself. */
export interface IKnowledgeGraph {
  neighbors(assetId: string): Promise<readonly KnowledgeRelationship[]>;
  shortestPath(fromAssetId: string, toAssetId: string): Promise<readonly string[] | undefined>;
}
