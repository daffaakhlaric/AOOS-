import type { KnowledgeVersionContext } from "../context/knowledge-version-context.js";
import type { KnowledgeVersionMetadata } from "../domain/knowledge-version-metadata.js";

import type { KnowledgeVersionPermissionGrant } from "./knowledge-version-permission-grant.js";

/**
 * "KnowledgeVersionPermission" (docs/PROMPT-005.7H-KNOWLEDGE-VERSIONING.md — "Domain
 * Model") — a real, non-stub, grant-based evaluator distinct from
 * `KnowledgeVersionPolicy`. Where Policy evaluates version/branch-type allow/deny lists
 * per tenant/workspace, Permission evaluates fine-grained tenant/workspace-scoped
 * allow/deny grants against a specific version's `versionType` and the attempted
 * operation — "deny always wins" semantics, permissive by default when no grant matches
 * a Context's scope at all (the permissive-when-unconfigured precedent set by
 * 005.7F/005.7G). Owns its own id-keyed store — the prompt's Registry has exactly 8
 * buckets and none is a Permission bucket.
 */
export class KnowledgeVersionPermission {
  private readonly grantsById = new Map<string, KnowledgeVersionPermissionGrant>();

  register(grant: KnowledgeVersionPermissionGrant): KnowledgeVersionPermissionGrant {
    this.grantsById.set(grant.id, grant);
    return grant;
  }

  get(id: string): KnowledgeVersionPermissionGrant | undefined {
    return this.grantsById.get(id);
  }

  list(): readonly KnowledgeVersionPermissionGrant[] {
    return Array.from(this.grantsById.values());
  }

  count(): number {
    return this.grantsById.size;
  }

  grantsFor(context: KnowledgeVersionContext): readonly KnowledgeVersionPermissionGrant[] {
    return this.list().filter(
      (grant) =>
        grant.scope.tenantId === context.tenantId &&
        (grant.scope.workspaceId === undefined || grant.scope.workspaceId === context.workspaceId),
    );
  }

  check(
    context: KnowledgeVersionContext,
    metadata?: KnowledgeVersionMetadata,
    operation?: string,
  ): boolean {
    const grants = this.grantsFor(context).filter(
      (grant) =>
        (grant.versionType === undefined || grant.versionType === metadata?.versionType) &&
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
