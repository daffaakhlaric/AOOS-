import type { KnowledgePolicyAuditEntry } from "../domain/knowledge-policy-audit.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgePolicyAuditProvider {
  record(entry: KnowledgePolicyAuditEntry): Promise<void>;
}
