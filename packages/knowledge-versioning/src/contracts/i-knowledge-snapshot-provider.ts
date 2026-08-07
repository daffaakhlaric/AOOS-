import type { KnowledgeSnapshot } from "../domain/knowledge-snapshot.js";

/** Interface only — no implementation in this package. An external provider that captures the actual asset content behind a recorded `KnowledgeSnapshot`. */
export interface IKnowledgeSnapshotProvider {
  capture(snapshot: KnowledgeSnapshot): void | Promise<void>;
}
