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

describe("KnowledgeSourcePermission additional coverage", () => {
  it("check() without a metadata argument still evaluates tenant/workspace-scoped grants", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ effect: "deny" }));
    expect(permission.check(contextFixture())).toBe(false);
  });

  it("a namespace-scoped grant does not match when metadata is omitted", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ namespace: "ns-1", effect: "deny" }));
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("role scoping does not currently filter (role is metadata-only on the grant)", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(
      grantFixture({ scope: { tenantId: "tenant-1", role: "editor" }, effect: "allow" }),
    );
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("multiple allow grants combine to an allow", () => {
    const registry = new KnowledgeSourceRegistry();
    const permission = new KnowledgeSourcePermission(registry);
    permission.register(grantFixture({ id: "g1", effect: "allow" }));
    permission.register(
      grantFixture({ id: "g2", category: KnowledgeSourceCategory.CRM, effect: "allow" }),
    );
    expect(
      permission.check(
        contextFixture(),
        metadataFixture({ sourceCategory: KnowledgeSourceCategory.CRM }),
      ),
    ).toBe(true);
  });
});
