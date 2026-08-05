import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/** Interface-only shape of a pluggable Source Catalog — `KnowledgeSourceCatalog` implements this structurally without declaring it, so a caller may supply an alternate (e.g. persisted) catalog implementation. */
export interface IKnowledgeSourceCatalog {
  register(metadata: KnowledgeSourceMetadataRecord): KnowledgeSourceMetadataRecord;
  remove(sourceId: string): boolean;
  get(sourceId: string): KnowledgeSourceMetadataRecord | undefined;
  all(): readonly KnowledgeSourceMetadataRecord[];
}
