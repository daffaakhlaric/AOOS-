import { describe, expect, it } from "vitest";

import { KnowledgeProviderCategory } from "../../src/domain/knowledge-provider-category.js";
import { KnowledgeProviderPolicy } from "../../src/policy/knowledge-provider-policy.js";
import { KnowledgeProviderRegistry } from "../../src/registry/knowledge-provider-registry.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeProviderPolicy", () => {
  it("allows a Provider when no Policy is registered", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("applicablePolicies() only returns enabled Policies whose scope covers the Context", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-enabled",
      name: "Enabled",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "p-disabled",
      name: "Disabled",
      scope: { tenantId: "tenant-1" },
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "p-other-tenant",
      name: "Other tenant",
      scope: { tenantId: "other" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(contextFixture()).map((p) => p.id)).toEqual(["p-enabled"]);
  });

  it("applicablePolicies() excludes a Policy scoped to a different workspaceId", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-workspace",
      name: "Workspace scoped",
      scope: { tenantId: "tenant-1", workspaceId: "other-workspace" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(contextFixture()).map((p) => p.id)).toEqual([]);
  });

  it("applicablePolicies() includes a Policy scoped to the Context's workspaceId", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-workspace",
      name: "Workspace scoped",
      scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(contextFixture()).map((p) => p.id)).toEqual(["p-workspace"]);
  });

  it("flags a violation when the Provider's category is not in allowedCategories", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-1",
      name: "Document only",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedCategories: [KnowledgeProviderCategory.DOCUMENT],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      metadataFixture({ providerCategory: KnowledgeProviderCategory.DATABASE }),
      contextFixture(),
    );
    expect(violations).toHaveLength(1);
  });

  it("flags a violation when the Provider's category is in deniedCategories", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-1",
      name: "No CRM",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      deniedCategories: [KnowledgeProviderCategory.CRM],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      metadataFixture({ providerCategory: KnowledgeProviderCategory.CRM }),
      contextFixture(),
    );
    expect(violations).toHaveLength(1);
  });

  it("passes when the Provider's category is within allowedCategories", () => {
    const policy = new KnowledgeProviderPolicy(new KnowledgeProviderRegistry());
    policy.register({
      id: "p-1",
      name: "Document allowed",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedCategories: [KnowledgeProviderCategory.DOCUMENT],
      createdAt: new Date().toISOString(),
    });
    expect(
      policy.evaluate(
        metadataFixture({ providerCategory: KnowledgeProviderCategory.DOCUMENT }),
        contextFixture(),
      ),
    ).toEqual([]);
  });
});
