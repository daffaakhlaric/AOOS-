import type { KnowledgeSourceConfigurationRecord } from "../configuration/knowledge-source-configuration-record.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";

/**
 * The combined record `KnowledgeSourcePipeline`'s Registration stage stores in
 * `KnowledgeSourceRegistry`'s `SOURCE` bucket — `id` satisfies the generic Registry's
 * `Identified` constraint (mirrored from `metadata.sourceId`), carrying both the
 * Metadata and Configuration together so `KnowledgeSourceMetrics`'s "Sync Enabled
 * Count"/"Schedule Count" can be derived by scanning this one bucket.
 */
export interface SourceRegistryEntry {
  readonly id: string;
  readonly metadata: KnowledgeSourceMetadataRecord;
  readonly configuration: KnowledgeSourceConfigurationRecord;
}
