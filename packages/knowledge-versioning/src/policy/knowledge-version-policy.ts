import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { KnowledgeBranchType } from "../domain/knowledge-branch-type.js";
import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

import type {
  KnowledgeVersionPolicyRecord,
  KnowledgeVersionPolicyViolation,
} from "./knowledge-version-policy-record.js";

/**
 * "KnowledgeVersionPolicy" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain Model")
 * — evaluates every enabled, scope-matching registered `KnowledgeVersionPolicyRecord`
 * against a version's `versionType` (and its branch's `branchType`, when known) — real,
 * non-stub evaluation logic. Judgment call: the prompt's Registry has exactly 8 buckets
 * and none is a Policy bucket, so this class owns its own id-keyed store rather than
 * borrowing a Registry bucket (unlike 005.7F/005.7G, whose Registries had POLICY
 * buckets).
 */
export class KnowledgeVersionPolicy {
  private readonly policiesById = new Map<string, KnowledgeVersionPolicyRecord>();

  register(policy: KnowledgeVersionPolicyRecord): KnowledgeVersionPolicyRecord {
    this.policiesById.set(policy.id, policy);
    return policy;
  }

  get(id: string): KnowledgeVersionPolicyRecord | undefined {
    return this.policiesById.get(id);
  }

  list(): readonly KnowledgeVersionPolicyRecord[] {
    return Array.from(this.policiesById.values());
  }

  count(): number {
    return this.policiesById.size;
  }

  applicablePolicies(context: KnowledgeVersionContext): readonly KnowledgeVersionPolicyRecord[] {
    return this.list().filter(
      (policy) =>
        policy.enabled &&
        policy.scope.tenantId === context.tenantId &&
        (policy.scope.workspaceId === undefined ||
          policy.scope.workspaceId === context.workspaceId),
    );
  }

  evaluate(
    metadata: KnowledgeVersionMetadata,
    context: KnowledgeVersionContext,
    branchType?: KnowledgeBranchType,
  ): readonly KnowledgeVersionPolicyViolation[] {
    const violations: KnowledgeVersionPolicyViolation[] = [];
    for (const policy of this.applicablePolicies(context)) {
      if (
        policy.allowedVersionTypes &&
        !policy.allowedVersionTypes.includes(metadata.versionType)
      ) {
        violations.push({
          policyId: policy.id,
          reason: `Version Type "${metadata.versionType}" is not in Policy "${policy.id}"'s allowedVersionTypes`,
        });
      }
      if (policy.deniedVersionTypes?.includes(metadata.versionType)) {
        violations.push({
          policyId: policy.id,
          reason: `Version Type "${metadata.versionType}" is denied by Policy "${policy.id}"`,
        });
      }
      if (branchType === undefined) {
        continue;
      }
      if (policy.allowedBranchTypes && !policy.allowedBranchTypes.includes(branchType)) {
        violations.push({
          policyId: policy.id,
          reason: `Branch Type "${branchType}" is not in Policy "${policy.id}"'s allowedBranchTypes`,
        });
      }
      if (policy.deniedBranchTypes?.includes(branchType)) {
        violations.push({
          policyId: policy.id,
          reason: `Branch Type "${branchType}" is denied by Policy "${policy.id}"`,
        });
      }
    }
    return violations;
  }
}
