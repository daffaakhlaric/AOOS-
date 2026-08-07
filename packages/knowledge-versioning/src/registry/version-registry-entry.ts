import type { KnowledgeVersionConfigurationRecord } from "../configuration/knowledge-version-configuration-record.js";
import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

/**
 * The combined record `KnowledgeVersioning` stores in `KnowledgeVersionRegistry`'s
 * `VERSION` bucket once a version passes the Pipeline — `id` mirrors
 * `metadata.versionId` to satisfy the generic Registry's `Identified` constraint,
 * carrying Metadata and Configuration together so the Resolver and the Validator's
 * Dependency stage can read one bucket.
 */
export interface VersionRegistryEntry {
  readonly id: string;
  readonly token: string;
  readonly metadata: KnowledgeVersionMetadata;
  readonly configuration: KnowledgeVersionConfigurationRecord;
}
