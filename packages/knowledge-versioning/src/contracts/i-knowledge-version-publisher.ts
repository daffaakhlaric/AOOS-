import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

/** Interface only — no implementation in this package. An external distribution channel a published version's metadata may be announced to (e.g. the future 005.7J Knowledge Marketplace). */
export interface IKnowledgeVersionPublisher {
  publish(metadata: KnowledgeVersionMetadata): void | Promise<void>;
}
