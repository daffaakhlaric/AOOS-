import { KnowledgeVersionBranchFactory } from "./knowledge-version-branch-factory.js";
import { KnowledgeVersionConfigurationFactory } from "./knowledge-version-configuration-factory.js";
import { KnowledgeVersionHistoryFactory } from "./knowledge-version-history-factory.js";
import { KnowledgeVersionMetadataFactory } from "./knowledge-version-metadata-factory.js";
import { KnowledgeVersionSnapshotFactory } from "./knowledge-version-snapshot-factory.js";
import { KnowledgeVersionVersionFactory } from "./knowledge-version-version-factory.js";

/**
 * "FACTORY: Version Factory, Snapshot Factory, Branch Factory, History Factory, Metadata
 * Factory, Configuration Factory." (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md) — the
 * top-level façade composing all 6 sub-factories as public readonly fields.
 */
export class KnowledgeVersionFactory {
  readonly version = new KnowledgeVersionVersionFactory();
  readonly snapshot = new KnowledgeVersionSnapshotFactory();
  readonly branch = new KnowledgeVersionBranchFactory();
  readonly history = new KnowledgeVersionHistoryFactory();
  readonly metadata = new KnowledgeVersionMetadataFactory();
  readonly configuration = new KnowledgeVersionConfigurationFactory();
}
