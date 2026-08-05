import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/** Interface-only shape of `KnowledgeSourceResolver` — lets a caller supply an alternate resolution strategy. */
export interface IKnowledgeSourceResolver {
  resolveById(sourceId: string): KnowledgeSourceMetadataRecord;
  tryResolveById(sourceId: string): KnowledgeSourceMetadataRecord | undefined;
}
