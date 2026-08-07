import type { KnowledgeValidationFinding } from "../domain/knowledge-validation-finding.js";
import type { KnowledgeValidationRule } from "../domain/knowledge-validation-rule.js";

/**
 * "IKnowledgeValidationRuleProvider" (docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md —
 * "Extension Points") — interface ONLY, never implemented in this package. The seam
 * through which a caller-supplied adapter executes a `KnowledgeValidationRule`'s actual
 * check logic — this package's own `KnowledgeValidationRule` records are metadata only.
 */
export interface IKnowledgeValidationRuleProvider {
  evaluateRule(
    rule: KnowledgeValidationRule,
    targetReference: string,
  ): Promise<readonly Omit<KnowledgeValidationFinding, "id" | "findingId" | "createdAt">[]>;
}
