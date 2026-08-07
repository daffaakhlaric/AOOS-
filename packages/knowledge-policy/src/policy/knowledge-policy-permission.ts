import type { KnowledgePolicyContext } from "../context/knowledge-policy-context.js";
import type { KnowledgePolicyMetadata } from "../domain/knowledge-policy-metadata.js";
import type { KnowledgePolicyPermissionGrant } from "../domain/knowledge-policy-permission-grant.js";

/**
 * "KnowledgePolicyPermission" — a real, non-stub, grant-based evaluator.
 * "deny always wins" semantics, permissive by default when no grant matches.
 */
export class KnowledgePolicyPermission {
  private readonly grantsById = new Map<string, KnowledgePolicyPermissionGrant>();

  register(grant: KnowledgePolicyPermissionGrant): KnowledgePolicyPermissionGrant {
    this.grantsById.set(grant.id, grant);
    return grant;
  }

  get(id: string): KnowledgePolicyPermissionGrant | undefined {
    return this.grantsById.get(id);
  }

  list(): readonly KnowledgePolicyPermissionGrant[] {
    return Array.from(this.grantsById.values());
  }

  count(): number {
    return this.grantsById.size;
  }

  grantsFor(context: KnowledgePolicyContext): readonly KnowledgePolicyPermissionGrant[] {
    return this.list().filter(
      (grant) =>
        grant.scope.tenantId === context.tenantId &&
        (grant.scope.workspaceId === undefined || grant.scope.workspaceId === context.workspaceId),
    );
  }

  check(
    context: KnowledgePolicyContext,
    metadata?: KnowledgePolicyMetadata,
    operation?: string,
  ): boolean {
    const grants = this.grantsFor(context).filter(
      (grant) =>
        (grant.policyType === undefined || grant.policyType === metadata?.policyType) &&
        (grant.operation === undefined || grant.operation === operation),
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
