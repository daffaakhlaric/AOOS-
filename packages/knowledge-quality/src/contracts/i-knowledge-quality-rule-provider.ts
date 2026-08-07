import type { KnowledgeQualityFinding } from "../domain/knowledge-quality-finding.js";
import type { KnowledgeQualityRule } from "../domain/knowledge-quality-rule.js";

/**
 * "IKnowledgeQualityRuleProvider" (docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md — "Extension
 * Points") — interface ONLY, never implemented in this package. The seam through which
 * a caller-supplied adapter executes a `KnowledgeQualityRule`'s actual check logic —
 * this package's own `KnowledgeQualityRule` records are metadata only, "no executable
 * rule logic."
 */
export interface IKnowledgeQualityRuleProvider {
  evaluateRule(
    rule: KnowledgeQualityRule,
    targetReference: string,
  ): Promise<readonly Omit<KnowledgeQualityFinding, "id" | "findingId" | "createdAt">[]>;
}
