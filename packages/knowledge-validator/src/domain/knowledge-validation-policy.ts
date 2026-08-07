import { z } from "zod";

import { KnowledgeValidationCategory } from "./knowledge-validation-category.js";

/**
 * "KnowledgeValidationPolicy" — an allow/deny-style Validation Policy record. Not one
 * of the 12 named Domain Model aggregates, and — like `KnowledgeValidationRequest` —
 * not backed by a Registry bucket (the Registry's 8 buckets from
 * docs/PROMPT-005.7M-KNOWLEDGE-VALIDATOR.md do not include POLICY); Policies are
 * tracked via a dedicated in-memory map inside `KnowledgeValidatorResolver`. Evaluation
 * logic lives in `evaluateKnowledgeValidationPolicy` below — real allow/deny
 * evaluation, matching the pattern established by `@aos/knowledge-policy` and
 * `@aos/knowledge-quality`.
 */
export const knowledgeValidationPolicySchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  allowedCategories: z.array(z.nativeEnum(KnowledgeValidationCategory)),
  requireApproval: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeValidationPolicy = z.infer<typeof knowledgeValidationPolicySchema>;

export interface KnowledgeValidationPolicyEvaluationInput {
  readonly categories: readonly KnowledgeValidationCategory[];
  readonly category: KnowledgeValidationCategory;
}

export interface KnowledgeValidationPolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Real allow/deny evaluation over a `KnowledgeValidationPolicy` — an inactive Policy
 * denies everything; an empty allow-list means "no restriction" (permissive-by-omission,
 * matching `@aos/knowledge-policy`'s evaluators).
 */
export function evaluateKnowledgeValidationPolicy(
  policy: KnowledgeValidationPolicy,
  input: KnowledgeValidationPolicyEvaluationInput,
): KnowledgeValidationPolicyEvaluationResult {
  const reasons: string[] = [];
  if (!policy.active) {
    reasons.push(`Policy "${policy.policyId}" is not active`);
  }
  if (policy.allowedCategories.length > 0) {
    if (!policy.allowedCategories.includes(input.category)) {
      reasons.push(
        `Validation Category "${input.category}" is not allowed by Policy "${policy.policyId}"`,
      );
    }
    const disallowed = input.categories.filter(
      (category) => !policy.allowedCategories.includes(category),
    );
    for (const category of disallowed) {
      reasons.push(`Rule Category "${category}" is not allowed by Policy "${policy.policyId}"`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
