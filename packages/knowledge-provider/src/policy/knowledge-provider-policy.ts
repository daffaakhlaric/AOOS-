import type { KnowledgeProviderContext } from "../context/knowledge-provider-context.js";
import type { ProviderMetadataRecord } from "../domain/provider-metadata-record.js";
import { KnowledgeProviderRegistryBucket } from "../registry/knowledge-provider-registry-bucket.js";
import type { KnowledgeProviderRegistry } from "../registry/knowledge-provider-registry.js";

import type {
  KnowledgeProviderPolicyRecord,
  KnowledgeProviderPolicyViolation,
} from "./knowledge-provider-policy-record.js";

/**
 * "KnowledgeProviderPolicy" (docs/PROMPT-005.7F-KNOWLEDGE-PROVIDER.md — "PUBLIC API") —
 * evaluates every enabled, scope-matching registered `KnowledgeProviderPolicyRecord`
 * (`KnowledgeProviderRegistry`'s `POLICY` bucket) against a Provider's
 * `providerCategory` — real, non-stub evaluation logic, mirroring
 * `@aos/knowledge-synchronization`'s `KnowledgeSynchronizationPolicy`.
 */
export class KnowledgeProviderPolicy {
  constructor(private readonly registry: KnowledgeProviderRegistry) {}

  register(policy: KnowledgeProviderPolicyRecord): KnowledgeProviderPolicyRecord {
    return this.registry.replace(KnowledgeProviderRegistryBucket.POLICY, policy);
  }

  applicablePolicies(context: KnowledgeProviderContext): readonly KnowledgeProviderPolicyRecord[] {
    return this.registry
      .list<KnowledgeProviderPolicyRecord>(KnowledgeProviderRegistryBucket.POLICY)
      .filter(
        (policy) =>
          policy.enabled &&
          policy.scope.tenantId === context.tenantId &&
          (policy.scope.workspaceId === undefined ||
            policy.scope.workspaceId === context.workspaceId),
      );
  }

  evaluate(
    metadata: ProviderMetadataRecord,
    context: KnowledgeProviderContext,
  ): readonly KnowledgeProviderPolicyViolation[] {
    const violations: KnowledgeProviderPolicyViolation[] = [];
    for (const policy of this.applicablePolicies(context)) {
      if (
        policy.allowedCategories &&
        !policy.allowedCategories.includes(metadata.providerCategory)
      ) {
        violations.push({
          policyId: policy.id,
          reason: `Category "${metadata.providerCategory}" is not in Policy "${policy.id}"'s allowedCategories`,
        });
      }
      if (policy.deniedCategories?.includes(metadata.providerCategory)) {
        violations.push({
          policyId: policy.id,
          reason: `Category "${metadata.providerCategory}" is denied by Policy "${policy.id}"`,
        });
      }
    }
    return violations;
  }
}
