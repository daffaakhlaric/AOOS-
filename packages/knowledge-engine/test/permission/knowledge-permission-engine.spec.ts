import { describe, expect, it } from "vitest";

import { DuplicateAssetException } from "../../src/errors/duplicate-asset-exception.js";
import { KnowledgePermissionEngine } from "../../src/permission/knowledge-permission-engine.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";

function permissionFixture(
  overrides: Partial<Parameters<KnowledgePermissionEngine["register"]>[0]> = {},
) {
  return {
    id: "perm-1",
    subjectType: "user" as const,
    subjectId: "user-1",
    action: "read",
    effect: "allow" as const,
    scope: scopeFixture(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Permission Test — KnowledgePermissionEngine", () => {
  it("register() then get()/list() return the registered Permission", () => {
    const engine = new KnowledgePermissionEngine();
    const permission = permissionFixture();
    engine.register(permission);
    expect(engine.get(permission.id)).toBe(permission);
    expect(engine.list()).toHaveLength(1);
  });

  it("register() throws DuplicateAssetException for a duplicate id", () => {
    const engine = new KnowledgePermissionEngine();
    engine.register(permissionFixture());
    expect(() => engine.register(permissionFixture())).toThrow(DuplicateAssetException);
  });

  it("check() defaults to permissive (true) when nothing is registered", () => {
    const engine = new KnowledgePermissionEngine();
    expect(engine.check(contextFixture(), assetFixture(), "read")).toBe(true);
  });

  it("check() returns true when the caller holds an applicable allow Permission", () => {
    const engine = new KnowledgePermissionEngine();
    const permission = permissionFixture();
    engine.register(permission);
    const context = contextFixture({ permissions: [permission.id] });
    expect(engine.check(context, assetFixture(), "read")).toBe(true);
  });

  it("check() returns false when the action is governed but the caller holds no applicable Permission", () => {
    const engine = new KnowledgePermissionEngine();
    engine.register(permissionFixture());
    const context = contextFixture({ permissions: [] });
    expect(engine.check(context, assetFixture(), "read")).toBe(false);
  });

  it("check() returns false when the caller holds a deny Permission, even alongside an allow", () => {
    const engine = new KnowledgePermissionEngine();
    const allow = permissionFixture({ id: "perm-allow", effect: "allow" });
    const deny = permissionFixture({ id: "perm-deny", effect: "deny" });
    engine.register(allow);
    engine.register(deny);
    const context = contextFixture({ permissions: [allow.id, deny.id] });
    expect(engine.check(context, assetFixture(), "read")).toBe(false);
  });

  it("check() respects the wildcard action '*'", () => {
    const engine = new KnowledgePermissionEngine();
    const permission = permissionFixture({ action: "*" });
    engine.register(permission);
    const context = contextFixture({ permissions: [permission.id] });
    expect(engine.check(context, assetFixture(), "delete")).toBe(true);
  });

  it("check() only applies a Permission whose environment matches the Context's environment", () => {
    const engine = new KnowledgePermissionEngine();
    const productionDeny = permissionFixture({
      id: "perm-prod-deny",
      environment: "production",
      effect: "deny",
    });
    const stagingAllow = permissionFixture({
      id: "perm-staging-allow",
      environment: "staging",
      effect: "allow",
    });
    engine.register(productionDeny);
    engine.register(stagingAllow);
    const context = contextFixture({
      permissions: [productionDeny.id, stagingAllow.id],
      environment: "staging",
    });
    // Only the staging-scoped allow is applicable in a "staging" Context — the
    // production-scoped deny is filtered out entirely, so it cannot block the result.
    expect(engine.check(context, assetFixture(), "read")).toBe(true);
  });

  it("check() ignores a Permission with no environment set regardless of the Context's environment", () => {
    const engine = new KnowledgePermissionEngine();
    const permission = permissionFixture();
    engine.register(permission);
    const context = contextFixture({
      permissions: [permission.id],
      environment: "any-environment",
    });
    expect(engine.check(context, assetFixture(), "read")).toBe(true);
  });

  it("check() ignores a Permission whose scope does not cover the Asset", () => {
    const engine = new KnowledgePermissionEngine();
    const permission = permissionFixture({ scope: scopeFixture({ tenantId: "other-tenant" }) });
    engine.register(permission);
    const context = contextFixture({ permissions: [permission.id] });
    expect(engine.check(context, assetFixture(), "read")).toBe(true);
  });
});
