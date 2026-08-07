import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";
import type { KnowledgePolicyState } from "../domain/knowledge-policy-state.js";
import type { KnowledgePolicyType } from "../domain/knowledge-policy-type.js";

/**
 * Interface only — no implementation in this package beyond the concrete
 * `KnowledgePolicyRecord` view class. The minimal read-only shape any "live policy"
 * object must satisfy.
 */
export interface IKnowledgePolicy {
  readonly id: string;
  readonly token: string;
  readonly policyId: string;
  readonly policyName: string;
  readonly policyType: KnowledgePolicyType;
  readonly priority: number;
  readonly state: KnowledgePolicyState;
  readonly metadata: KnowledgePolicyMetadata;
}
