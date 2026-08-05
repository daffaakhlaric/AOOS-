import type { KnowledgeSourceContext } from "../context/knowledge-source-context.js";
import type { KnowledgeSourceMetadataRecord } from "../domain/knowledge-source-metadata-record.js";
import { KnowledgeSourceRegistryBucket } from "../registry/knowledge-source-registry-bucket.js";
import type { KnowledgeSourceRegistry } from "../registry/knowledge-source-registry.js";

import type { KnowledgeSourcePermissionGrant } from "./knowledge-source-permission-grant.js";

/**
 * "KnowledgeSourcePermission" (docs/PROMPT-005.7G-KNOWLEDGE-SOURCE-MANAGER.md — "PUBLIC
 * API") — a real, non-stub, grant-based evaluator distinct from `KnowledgeSourcePolicy`.
 * Where `KnowledgeSourcePolicy` evaluates category allow/deny lists per tenant/workspace,
 * `KnowledgeSourcePermission` evaluates fine-grained tenant/workspace/role-scoped
 * allow/deny grants against a specific Source's `namespace`/`category` — "deny always
 * wins" semantics, permissive by default when no grant matches a Context's scope at all
 * (mirroring the permissive-when-unconfigured precedent set by
 * `@aos/knowledge-provider`'s `IProviderPermissionChecker`).
 */
export class KnowledgeSourcePermission {
  constructor(private readonly registry: KnowledgeSourceRegistry) {}

  register(grant: KnowledgeSourcePermissionGrant): KnowledgeSourcePermissionGrant {
    return this.registry.replace(KnowledgeSourceRegistryBucket.PERMISSION, grant);
  }

  grantsFor(context: KnowledgeSourceContext): readonly KnowledgeSourcePermissionGrant[] {
    return this.registry
      .list<KnowledgeSourcePermissionGrant>(KnowledgeSourceRegistryBucket.PERMISSION)
      .filter(
        (grant) =>
          grant.scope.tenantId === context.tenantId &&
          (grant.scope.workspaceId === undefined ||
            grant.scope.workspaceId === context.workspaceId),
      );
  }

  check(context: KnowledgeSourceContext, metadata?: KnowledgeSourceMetadataRecord): boolean {
    const grants = this.grantsFor(context).filter(
      (grant) =>
        (grant.namespace === undefined || grant.namespace === metadata?.namespace) &&
        (grant.category === undefined || grant.category === metadata?.sourceCategory),
    );
    if (grants.length === 0) {
      return true;
    }
    if (grants.some((grant) => grant.effect === "deny")) {
      return false;
    }
    return grants.some((grant) => grant.effect === "allow");
  }
}
