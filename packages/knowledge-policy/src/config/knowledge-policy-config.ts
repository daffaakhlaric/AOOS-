import type { IKnowledgeActionResolver } from "../contracts/i-knowledge-action-resolver.js";
import type { IKnowledgeComplianceProvider } from "../contracts/i-knowledge-compliance-provider.js";
import type { IKnowledgeConditionResolver } from "../contracts/i-knowledge-condition-resolver.js";
import type { IKnowledgePolicyAuditProvider } from "../contracts/i-knowledge-policy-audit-provider.js";
import type { IKnowledgePolicyConflictResolver } from "../contracts/i-knowledge-policy-conflict-resolver.js";
import type { IKnowledgePolicyEvaluator } from "../contracts/i-knowledge-policy-evaluator.js";
import type { IKnowledgePolicyProvider } from "../contracts/i-knowledge-policy-provider.js";
import type { IKnowledgePolicyPublisher } from "../contracts/i-knowledge-policy-publisher.js";
import type { IKnowledgePolicyStorage } from "../contracts/i-knowledge-policy-storage.js";
import type { IKnowledgeScopeResolver } from "../contracts/i-knowledge-scope-resolver.js";

/**
 * "EXTENSION POINTS: Create INTERFACES ONLY. Do NOT implement."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — every field is optional.
 */
export interface KnowledgePolicyConfig {
  readonly evaluator?: IKnowledgePolicyEvaluator;
  readonly provider?: IKnowledgePolicyProvider;
  readonly complianceProvider?: IKnowledgeComplianceProvider;
  readonly conditionResolver?: IKnowledgeConditionResolver;
  readonly actionResolver?: IKnowledgeActionResolver;
  readonly scopeResolver?: IKnowledgeScopeResolver;
  readonly storage?: IKnowledgePolicyStorage;
  readonly publisher?: IKnowledgePolicyPublisher;
  readonly auditProvider?: IKnowledgePolicyAuditProvider;
  readonly conflictResolver?: IKnowledgePolicyConflictResolver;
}
