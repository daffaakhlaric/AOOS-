import { describe, expect, it } from "vitest";

import { KnowledgeBranchType } from "../../src/domain/knowledge-branch-type.js";
import { KnowledgeVersionType } from "../../src/domain/knowledge-version-type.js";
import { KnowledgeVersionPolicy } from "../../src/policy/knowledge-version-policy.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeVersionPolicy", () => {
  it("evaluates with no violations when no policies are registered", () => {
    const policy = new KnowledgeVersionPolicy();
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("registers, gets, lists, counts policies", () => {
    const policy = new KnowledgeVersionPolicy();
    const record = {
      id: "p1",
      name: "test-policy",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    policy.register(record);
    expect(policy.get("p1")).toEqual(record);
    expect(policy.list()).toHaveLength(1);
    expect(policy.count()).toBe(1);
  });

  it("applicablePolicies() filters disabled and out-of-scope policies", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "disabled",
      name: "disabled",
      scope: { tenantId: "tenant-1" },
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "other-tenant",
      name: "other",
      scope: { tenantId: "other-tenant" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "matching",
      name: "matching",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    const applicable = policy.applicablePolicies(contextFixture());
    expect(applicable.map((p) => p.id)).toEqual(["matching"]);
  });

  it("flags a versionType not in allowedVersionTypes", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedVersionTypes: [KnowledgeVersionType.MINOR],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(metadataFixture(), contextFixture());
    expect(violations).toHaveLength(1);
  });

  it("flags a denied versionType", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedVersionTypes: [KnowledgeVersionType.MAJOR],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(metadataFixture(), contextFixture());
    expect(violations).toHaveLength(1);
  });

  it("skips branch checks when no branchType is supplied", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedBranchTypes: [KnowledgeBranchType.MAIN],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(metadataFixture(), contextFixture());
    expect(violations).toEqual([]);
  });

  it("flags a branchType not in allowedBranchTypes", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedBranchTypes: [KnowledgeBranchType.MAIN],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      metadataFixture(),
      contextFixture(),
      KnowledgeBranchType.FEATURE,
    );
    expect(violations).toHaveLength(1);
  });

  it("flags a denied branchType", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedBranchTypes: [KnowledgeBranchType.EXPERIMENT],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      metadataFixture(),
      contextFixture(),
      KnowledgeBranchType.EXPERIMENT,
    );
    expect(violations).toHaveLength(1);
  });

  it("respects a workspace-scoped policy", () => {
    const policy = new KnowledgeVersionPolicy();
    policy.register({
      id: "p1",
      name: "p1",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      enabled: true,
      deniedVersionTypes: [KnowledgeVersionType.MAJOR],
      createdAt: new Date().toISOString(),
    });
    expect(
      policy.evaluate(metadataFixture(), contextFixture({ workspaceId: "workspace-1" })),
    ).toHaveLength(1);
    expect(
      policy.evaluate(metadataFixture(), contextFixture({ workspaceId: "other-workspace" })),
    ).toEqual([]);
  });
});
