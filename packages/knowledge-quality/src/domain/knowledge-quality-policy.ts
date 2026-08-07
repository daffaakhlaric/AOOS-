import { z } from "zod";

import { KnowledgeQualityAssessmentMode } from "./knowledge-quality-assessment-mode.js";
import { KnowledgeQualityDimension } from "./knowledge-quality-dimension.js";

/**
 * "KnowledgeQualityPolicy" — an allow/deny-style Quality Policy record. Not one of the
 * 12 named Domain Model aggregates, and — like `KnowledgeQualityAssessmentRequest` — not
 * backed by a Registry bucket (the Registry's 8 buckets from
 * docs/PROMPT-005.7L-KNOWLEDGE-QUALITY.md do not include POLICY); Policies are tracked
 * via a dedicated in-memory map inside `KnowledgeQualityResolver`. Evaluation logic
 * lives in `evaluateKnowledgeQualityPolicy` below, matching the real-evaluation Policy
 * pattern established by `@aos/knowledge-policy`.
 */
export const knowledgeQualityPolicySchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  allowedDimensions: z.array(z.nativeEnum(KnowledgeQualityDimension)),
  allowedModes: z.array(z.nativeEnum(KnowledgeQualityAssessmentMode)),
  requireApproval: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeQualityPolicy = z.infer<typeof knowledgeQualityPolicySchema>;

export interface KnowledgeQualityPolicyEvaluationInput {
  readonly dimensions: readonly KnowledgeQualityDimension[];
  readonly mode: KnowledgeQualityAssessmentMode;
}

export interface KnowledgeQualityPolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Real allow/deny evaluation over a `KnowledgeQualityPolicy` — an inactive Policy
 * denies everything; an empty allow-list for a dimension means "no restriction" on that
 * dimension (matching the permissive-by-omission convention used by
 * `@aos/knowledge-policy`'s evaluators).
 */
export function evaluateKnowledgeQualityPolicy(
  policy: KnowledgeQualityPolicy,
  input: KnowledgeQualityPolicyEvaluationInput,
): KnowledgeQualityPolicyEvaluationResult {
  const reasons: string[] = [];
  if (!policy.active) {
    reasons.push(`Policy "${policy.policyId}" is not active`);
  }
  if (policy.allowedModes.length > 0 && !policy.allowedModes.includes(input.mode)) {
    reasons.push(`Assessment Mode "${input.mode}" is not allowed by Policy "${policy.policyId}"`);
  }
  if (policy.allowedDimensions.length > 0) {
    const disallowed = input.dimensions.filter(
      (dimension) => !policy.allowedDimensions.includes(dimension),
    );
    for (const dimension of disallowed) {
      reasons.push(`Dimension "${dimension}" is not allowed by Policy "${policy.policyId}"`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
