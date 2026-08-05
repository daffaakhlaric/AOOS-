import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";
import type { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";

import type {
  KnowledgeSourcePolicyRecord,
  KnowledgeSourcePolicyViolation,
} from "./knowledge-source-policy-record.js";

/**
 * "KnowledgeSourcePolicy" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC API")
 * — evaluates every enabled, scope-matching registered `KnowledgeSourcePolicyRecord`
 * (`KnowledgeSourceRegistry`'s `POLICY` bucket) against a Source's `sourceCategory` —
 * real, non-stub evaluation logic. This is the coarse "may Sources of this Category
 * exist for this tenant/workspace" gate, distinct from `KnowledgeSourcePermission`'s
 * finer-grained "may this actor act on this Source" gate.
 */
export class KnowledgeSourcePolicy {
  constructor(private readonly registry: KnowledgeSourceRegistry) {}

  register(policy: KnowledgeSourcePolicyRecord): KnowledgeSourcePolicyRecord {
    return this.registry.replace(KnowledgeSourceRegistryBucket.POLICY, policy);
  }

  applicablePolicies(context: KnowledgeSourceContext): readonly KnowledgeSourcePolicyRecord[] {
    return this.registry
      .list<KnowledgeSourcePolicyRecord>(KnowledgeSourceRegistryBucket.POLICY)
      .filter(
        (policy) =>
          policy.enabled &&
          policy.scope.tenantId === context.tenantId &&
          (policy.scope.workspaceId === undefined ||
            policy.scope.workspaceId === context.workspaceId),
      );
  }

  evaluate(
    metadata: KnowledgeSourceMetadataRecord,
    context: KnowledgeSourceContext,
  ): readonly KnowledgeSourcePolicyViolation[] {
    const violations: KnowledgeSourcePolicyViolation[] = [];
    for (const policy of this.applicablePolicies(context)) {
      if (policy.allowedCategories && !policy.allowedCategories.includes(metadata.sourceCategory)) {
        violations.push({
          policyId: policy.id,
          reason: `Category "${metadata.sourceCategory}" is not in Policy "${policy.id}"'s allowedCategories`,
        });
      }
      if (policy.deniedCategories?.includes(metadata.sourceCategory)) {
        violations.push({
          policyId: policy.id,
          reason: `Category "${metadata.sourceCategory}" is denied by Policy "${policy.id}"`,
        });
      }
    }
    return violations;
  }
}
