import { z } from "zod";

import { KnowledgeGenerationAssetType } from "./knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "./knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "./knowledge-generation-provider-type.js";

/**
 * "KnowledgeGenerationPolicy" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Domain
 * Model") — an allow/deny-style Generation Policy record. Evaluation logic lives in
 * `KnowledgeGenerationPolicyEvaluator` (`policy/knowledge-generation-policy-evaluator.ts`),
 * matching the real-evaluation Policy pattern established by `@aos/knowledge-policy`.
 */
export const knowledgeGenerationPolicySchema = z.object({
  id: z.string().min(1),
  policyId: z.string().min(1),
  name: z.string().min(1),
  tenantId: z.string().min(1),
  allowedAssetTypes: z.array(z.nativeEnum(KnowledgeGenerationAssetType)),
  allowedProviderTypes: z.array(z.nativeEnum(KnowledgeGenerationProviderType)),
  allowedModes: z.array(z.nativeEnum(KnowledgeGenerationMode)),
  requireApproval: z.boolean().default(false),
  active: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeGenerationPolicy = z.infer<typeof knowledgeGenerationPolicySchema>;

export interface KnowledgeGenerationPolicyEvaluationInput {
  readonly assetType: KnowledgeGenerationAssetType;
  readonly mode: KnowledgeGenerationMode;
  readonly providerType: KnowledgeGenerationProviderType;
}

export interface KnowledgeGenerationPolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Real allow/deny evaluation over a `KnowledgeGenerationPolicy` — an inactive Policy
 * denies everything; an empty allow-list for a dimension means "no restriction" on that
 * dimension (matching the permissive-by-omission convention used by
 * `@aos/knowledge-policy`'s evaluators).
 */
export function evaluateKnowledgeGenerationPolicy(
  policy: KnowledgeGenerationPolicy,
  input: KnowledgeGenerationPolicyEvaluationInput,
): KnowledgeGenerationPolicyEvaluationResult {
  const reasons: string[] = [];
  if (!policy.active) {
    reasons.push(`Policy "${policy.policyId}" is not active`);
  }
  if (policy.allowedAssetTypes.length > 0 && !policy.allowedAssetTypes.includes(input.assetType)) {
    reasons.push(`Asset Type "${input.assetType}" is not allowed by Policy "${policy.policyId}"`);
  }
  if (policy.allowedModes.length > 0 && !policy.allowedModes.includes(input.mode)) {
    reasons.push(`Generation Mode "${input.mode}" is not allowed by Policy "${policy.policyId}"`);
  }
  if (
    policy.allowedProviderTypes.length > 0 &&
    !policy.allowedProviderTypes.includes(input.providerType)
  ) {
    reasons.push(
      `Provider Type "${input.providerType}" is not allowed by Policy "${policy.policyId}"`,
    );
  }
  return { allowed: reasons.length === 0, reasons };
}
