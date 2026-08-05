import type { KnowledgePolicy } from "../domain/knowledge-policy.js";

export interface PolicyViolation {
  readonly policyId: string;
  readonly assetId: string;
  readonly message: string;
}

export function violation(
  policy: KnowledgePolicy,
  assetId: string,
  message: string,
): PolicyViolation {
  return { policyId: policy.id, assetId, message };
}
