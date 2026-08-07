import type { KnowledgeVersionAuditEntry } from "../domain/knowledge-version-audit.js";

/** Interface only — no implementation in this package. An external audit sink the Pipeline's Audit stage forwards every `KnowledgeVersionAuditEntry` to when a caller wires one in via `KnowledgeVersioningConfig`. */
export interface IKnowledgeAuditProvider {
  record(entry: KnowledgeVersionAuditEntry): void | Promise<void>;
}
