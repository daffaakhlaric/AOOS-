import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

/** Interface only — no implementation in this package. An external, durable store for version metadata records — this package is in-memory only. */
export interface IKnowledgeVersionStorage {
  save(metadata: KnowledgeVersionMetadata): void | Promise<void>;
  load(
    versionId: string,
  ): KnowledgeVersionMetadata | undefined | Promise<KnowledgeVersionMetadata | undefined>;
  delete(versionId: string): void | Promise<void>;
}
