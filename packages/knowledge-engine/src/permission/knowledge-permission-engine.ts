import type { KnowledgeContext } from "../context/knowledge-context.js";
import type { KnowledgeAsset } from "../domain/knowledge-asset.js";
import type { KnowledgePermission } from "../domain/knowledge-permission.js";
import { scopeContains } from "../domain/knowledge-scope.js";
import { DuplicateAssetException } from "../errors/duplicate-asset-exception.js";

/**
 * "PERMISSION ENGINE: Role Based, Policy Based, Department, Workspace, Solution Pack,
 * Tenant, Organization, Environment." (docs/PROMPT-005.7A-KNOWLEDGE-ENGINE.md). Not a
 * `KnowledgeRegistry` bucket — the Registry list ("Schemas, Templates, Categories,
 * Policies, Providers, Namespaces, Relationships, Libraries, Collections, Versions") does
 * not include Permissions, so this Engine owns its own in-memory store.
 *
 * `check()` semantics: a `deny` held by the caller (`context.permissions`) always wins; an
 * `allow` held by the caller wins next; if the action/scope is governed by at least one
 * *registered* Permission but the caller holds none of the applicable ones, the result is
 * `false` (explicit deny-by-omission); if nothing registered governs this action/scope at
 * all, the result is `true` (permissive default, matching every other AOS extension
 * point).
 */
export class KnowledgePermissionEngine {
  private readonly permissionsById = new Map<string, KnowledgePermission>();

  register(permission: KnowledgePermission): KnowledgePermission {
    if (this.permissionsById.has(permission.id)) {
      throw new DuplicateAssetException(
        `KnowledgePermission "${permission.id}" is already registered`,
      );
    }
    this.permissionsById.set(permission.id, permission);
    return permission;
  }

  get(id: string): KnowledgePermission | undefined {
    return this.permissionsById.get(id);
  }

  list(): readonly KnowledgePermission[] {
    return Array.from(this.permissionsById.values());
  }

  check(context: KnowledgeContext, asset: KnowledgeAsset, action: string): boolean {
    const applicable = this.list().filter((permission) =>
      this.isApplicable(permission, context, asset, action),
    );
    const held = applicable.filter((permission) => context.permissions.includes(permission.id));

    if (held.some((permission) => permission.effect === "deny")) {
      return false;
    }
    if (held.some((permission) => permission.effect === "allow")) {
      return true;
    }
    return applicable.length === 0;
  }

  private isApplicable(
    permission: KnowledgePermission,
    context: KnowledgeContext,
    asset: KnowledgeAsset,
    action: string,
  ): boolean {
    if (permission.action !== action && permission.action !== "*") {
      return false;
    }
    if (permission.environment !== undefined && permission.environment !== context.environment) {
      return false;
    }
    return scopeContains(permission.scope, asset.scope);
  }
}
