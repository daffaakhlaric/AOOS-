import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import type { KnowledgeSourcePermissionGrant } from "../../src/permission/knowledge-source-permission-grant.js";
import { KnowledgeSourcePermission } from "../../src/permission/knowledge-source-permission.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function grantFixture(
  overrides: Partial<KnowledgeSourcePermissionGrant> = {},
): KnowledgeSourcePermissionGrant {
  return {
    id: "grant-1",
    scope: { tenantId: "tenant-1" },
    effect: "allow",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("KnowledgeSourcePermission", () => {
  it("registers a grant", () => {
    const permission = new KnowledgeSourcePermission(new KnowledgeSourceRegistry());
    expect(permission.register(grantFixture()).id).toBe("grant-1");
  });

  it("is permissive by default when no grant matches the Context's scope", () => {
    const permission = new KnowledgeSourcePermission(new KnowledgeSourceRegistry());
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("allows when an allow grant matches", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ effect: "allow" }));
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("denies when a deny grant matches", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ effect: "deny" }));
    expect(permission.check(contextFixture())).toBe(false);
  });

  it("deny always wins over allow", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ id: "g-allow", effect: "allow" }));
    permission.register(grantFixture({ id: "g-deny", effect: "deny" }));
    expect(permission.check(contextFixture())).toBe(false);
  });

  it("scopes by workspaceId when specified", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(
      grantFixture({ scope: { tenantId: "tenant-1", workspaceId: "workspace-1" }, effect: "deny" }),
    );
    expect(permission.check(contextFixture({ workspaceId: "workspace-1" }))).toBe(false);
    expect(permission.check(contextFixture({ workspaceId: "workspace-2" }))).toBe(true);
  });

  it("scopes by namespace when specified on the grant", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ namespace: "ns-1", effect: "deny" }));
    expect(permission.check(contextFixture(), metadataFixture({ namespace: "ns-1" }))).toBe(false);
    expect(permission.check(contextFixture(), metadataFixture({ namespace: "ns-2" }))).toBe(true);
  });

  it("scopes by category when specified on the grant", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ category: KnowledgeSourceCategory.CRM, effect: "deny" }));
    expect(
      permission.check(
        contextFixture(),
        metadataFixture({ sourceCategory: KnowledgeSourceCategory.CRM }),
      ),
    ).toBe(false);
    expect(
      permission.check(
        contextFixture(),
        metadataFixture({ sourceCategory: KnowledgeSourceCategory.DOCUMENT }),
      ),
    ).toBe(true);
  });

  it("grantsFor filters by tenant scope", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture());
    permission.register(grantFixture({ id: "other", scope: { tenantId: "other-tenant" } }));
    expect(permission.grantsFor(contextFixture())).toHaveLength(1);
  });
});
