import { describe, expect, it } from "vitest";

import { KnowledgeVersionOperation } from "../../src/domain/knowledge-version-operation.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersionPermission } from "../../src/permission/knowledge-version-permission.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeVersionPermission", () => {
  it("is permissive when no grants exist", () => {
    const permission = new KnowledgeVersionPermission();
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("registers, gets, lists and counts grants", () => {
    const permission = new KnowledgeVersionPermission();
    const grant = {
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "allow" as const,
      createdAt: new Date().toISOString(),
    };
    permission.register(grant);
    expect(permission.get("g1")).toEqual(grant);
    expect(permission.list()).toHaveLength(1);
    expect(permission.count()).toBe(1);
  });

  it("filters grantsFor() by tenant and workspace scope", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    permission.register({
      id: "g2",
      scope: { tenantId: "other-tenant" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    const grants = permission.grantsFor(contextFixture());
    expect(grants.map((g) => g.id)).toEqual(["g1"]);
  });

  it("deny always wins over allow", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "allow",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    permission.register({
      id: "deny",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      createdAt: new Date().toISOString(),
    });
    expect(permission.check(contextFixture())).toBe(false);
  });

  it("requires at least one matching allow grant when grants exist for the scope", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
      versionType: KnowledgeVersionType.MINOR,
      createdAt: new Date().toISOString(),
    });
    const metadata = metadataFixture({ versionType: KnowledgeVersionType.MAJOR });
    // grant is scoped to MINOR but metadata is MAJOR -> no grants match -> permissive default
    expect(permission.check(contextFixture(), metadata)).toBe(true);
  });

  it("evaluates versionType and operation scoped grants", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1" },
      effect: "deny",
      versionType: KnowledgeVersionType.MAJOR,
      operation: KnowledgeVersionOperation.PUBLISH_VERSION,
      createdAt: new Date().toISOString(),
    });
    const metadata = metadataFixture({ versionType: KnowledgeVersionType.MAJOR });
    expect(
      permission.check(contextFixture(), metadata, KnowledgeVersionOperation.PUBLISH_VERSION),
    ).toBe(false);
    expect(
      permission.check(contextFixture(), metadata, KnowledgeVersionOperation.ARCHIVE_VERSION),
    ).toBe(true);
  });

  it("returns true when matching grants exist and none is a deny", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "allow-only",
      scope: { tenantId: "tenant-1" },
      effect: "allow",
      createdAt: new Date().toISOString(),
    });
    expect(permission.check(contextFixture())).toBe(true);
  });

  it("respects an optional workspace-scoped grant matching the context workspace", () => {
    const permission = new KnowledgeVersionPermission();
    permission.register({
      id: "g1",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      effect: "deny",
      createdAt: new Date().toISOString(),
    });
    expect(permission.check(contextFixture({ workspaceId: "workspace-1" }))).toBe(false);
    expect(permission.check(contextFixture({ workspaceId: "other-workspace" }))).toBe(true);
  });
});
