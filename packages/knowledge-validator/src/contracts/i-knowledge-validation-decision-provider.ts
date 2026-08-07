import type { KnowledgeValidationDecisionValue } from "../domain/knowledge-validation-decision-value.js";
import type { KnowledgeValidationRequest } from "../domain/knowledge-validation-request.js";

export interface KnowledgeValidationDecisionInput {
  readonly value: KnowledgeValidationDecisionValue;
  readonly confidence?: number;
  readonly reason?: string;
  readonly reportedBy: string;
}

/**
 * "IKnowledgeValidationDecisionProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY, never implemented in this package. The seam
 * through which a caller-supplied reviewer/decision engine reports which of the 6
 * Validation Decision values applies to a Validation. This package NEVER computes the
 * decision itself — it only records what this interface reports, as a
 * `KnowledgeValidationDecision`.
 */
export interface IKnowledgeValidationDecisionProvider {
  decide(request: KnowledgeValidationRequest): Promise<KnowledgeValidationDecisionInput>;
}
