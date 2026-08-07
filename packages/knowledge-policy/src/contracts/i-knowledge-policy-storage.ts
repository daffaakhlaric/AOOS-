import type { KnowledgePolicyExecution } from "../domain/knowledge-policy-execution.js";

/** Extension Point — interface only, no implementation in this package. */
export interface IKnowledgePolicyStorage {
  load(policyId: string): Promise<KnowledgePolicyExecution | undefined>;
  save(execution: KnowledgePolicyExecution): Promise<void>;
  delete(policyId: string): Promise<void>;
}
