import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";
import type { KnowledgePolicyAssignment } from "../domain/knowledge-policy-assignment.js";
import type { KnowledgePolicyConfigurationRecord } from "../domain/knowledge-policy-configuration-record.js";
import type { KnowledgePolicyEvaluation } from "../domain/knowledge-policy-evaluation.js";
import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";
import type { KnowledgePolicyRecord } from "../domain/knowledge-policy-record.js";
import type { KnowledgePolicyRule } from "../domain/knowledge-policy-rule.js";
import type { KnowledgePolicyScope } from "../domain/knowledge-policy-scope.js";

/**
 * "POLICY OPERATIONS: Implement CONTRACTS ONLY. ... No business execution.
 * No permission execution. Metadata only."
 * (docs/PROMPT-005.7I-KNOWLEDGE-POLICY.md) — typed input/result contracts for
 * each of the 10 operations.
 */
export interface CreatePolicyInput {
  readonly metadata: KnowledgePolicyMetadata;
  readonly configuration: KnowledgePolicyConfigurationRecord;
  readonly context: KnowledgePolicyContext;
  readonly rules?: readonly KnowledgePolicyRule[];
  readonly scopes?: readonly KnowledgePolicyScope[];
}

export interface ValidatePolicyInput {
  readonly token: string;
}

export interface ActivatePolicyInput {
  readonly token: string;
  readonly reason?: string;
}

export interface SuspendPolicyInput {
  readonly token: string;
  readonly reason?: string;
}

export interface ArchivePolicyInput {
  readonly token: string;
  readonly reason?: string;
}

export interface RestorePolicyInput {
  readonly token: string;
  readonly reason?: string;
}

export interface DestroyPolicyInput {
  readonly token: string;
  readonly reason?: string;
}

export interface AssignPolicyInput {
  readonly token: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly priority?: number;
}

export interface AssignPolicyResult {
  readonly policy: KnowledgePolicyRecord;
  readonly assignment: KnowledgePolicyAssignment;
}

export interface UnassignPolicyInput {
  readonly token: string;
  readonly assignmentId: string;
}

export interface EvaluatePolicyInput {
  readonly token: string;
  readonly targetId: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface EvaluatePolicyResult {
  readonly policy: KnowledgePolicyRecord;
  readonly evaluation: KnowledgePolicyEvaluation;
}
