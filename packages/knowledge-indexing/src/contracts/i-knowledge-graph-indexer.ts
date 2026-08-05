import type { KnowledgeRelationship } from "@aos/knowledge-engine";

/** Interface only — no implementation in this package. A future graph database adapter would index Relationship edges under this contract. */
export interface IKnowledgeGraphIndexer {
  index(assetId: string, relationships: readonly KnowledgeRelationship[]): Promise<void>;
  remove(assetId: string): Promise<void>;
}
