import { describe, expect, it } from "vitest";

import { KnowledgePolicyPermission } from "../../src/policy/knowledge-policy-permission.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgePolicyPermission", () => {
  it("check() returns true when no grants match (permissive default)", () => {
    const permission = new KnowledgePolicyPermission();
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("register() adds a grant retrievable by get()", () => {
    const permission = new KnowledgePolicyPermission();
    const grant = permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
    });
    expect(permission.get("g1")).toEqual(grant);
    expect(permission.count()).toBe(1);
    expect(permission.list()).toEqual([grant]);
  });

  it("get() returns undefined for an unknown id", () => {
    const permission = new KnowledgePolicyPermission();
    expect(permission.get("missing")).toBeUndefined();
  });

  it("grantsFor() filters by tenantId", () => {
    const permission = new KnowledgePolicyPermission();
    permission.register({ id: "g1", scope: { tenantId: "tenant-1" }, effect: "allow" });
    permission.register({ id: "g2", scope: { tenantId: "tenant-2" }, effect: "allow" });
    const grants = permission.grantsFor(contextFixture({ tenantId: "tenant-1" }));
    expect(grants).toHaveLength(1);
    expect(grants[0]?.id).toBe("g1");
  });

  it("grantsFor() filters by workspaceId when the grant specifies one", () => {
    const permission = new KnowledgePolicyPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      effect: "allow",
    });
    expect(
      permission.grantsFor(contextFixture({ tenantId: "tenant-1", workspaceId: "workspace-2" })),
    ).toHaveLength(0);
    expect(
      permission.grantsFor(contextFixture({ tenantId: "tenant-1", workspaceId: "workspace-1" })),
    ).toHaveLength(1);
  });

  it("check() denies when a matching deny grant exists — deny always wins", () => {
    const permission = new KnowledgePolicyPermission();
    permission.register({ id: "g1", scope: { tenantId: "tenant-1" }, effect: "deny" });
    permission.register({ id: "g2", scope: { tenantId: "tenant-1" }, effect: "allow" });
    expect(permission.check(contextFixture({ tenantId: "tenant-1" }))).toBe(false);
  });

  it("check() allows when only an allow grant matches", () => {
    const permission = new KnowledgePolicyPermission();
    permission.register({ id: "g1", scope: { tenantId: "tenant-1" }, effect: "allow" });
    expect(permission.check(contextFixture({ tenantId: "tenant-1" }))).toBe(true);
  });

  it("check() filters grants by policyType and operation when specified", () => {
    const permission = new KnowledgePolicyPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      policyType: "access",
      operation: "destroy_policy",
    });
    const metadata = metadataFixture({ tenantId: "tenant-1" });
    expect(
      permission.check(contextFixture({ tenantId: "tenant-1" }), metadata, "create_policy"),
    ).toBe(true);
    expect(
      permission.check(contextFixture({ tenantId: "tenant-1" }), metadata, "destroy_policy"),
    ).toBe(false);
  });
});
