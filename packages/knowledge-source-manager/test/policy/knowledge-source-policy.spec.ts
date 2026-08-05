import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import type { KnowledgeSourcePolicyRecord } from "../../src/policy/knowledge-source-policy-record.js";
import { KnowledgeSourcePolicy } from "../../src/policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function policyFixture(
  overrides: Partial<KnowledgeSourcePolicyRecord> = {},
): KnowledgeSourcePolicyRecord {
  return {
    id: "policy-1",
    name: "Test Policy",
    scope: { tenantId: "tenant-1" },
    enabled: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("KnowledgeSourcePolicy", () => {
  it("registers a policy", () => {
    const policy = new KnowledgeSourcePolicy(new KnowledgeSourceRegistry());
    expect(policy.register(policyFixture()).id).toBe("policy-1");
  });

  it("evaluate returns no violations when no policy applies", () => {
    const policy = new KnowledgeSourcePolicy(new KnowledgeSourceRegistry());
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("evaluate flags a category not in allowedCategories", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(policyFixture({ allowedCategories: [KnowledgeSourceCategory.CRM] }));
    const violations = policy.evaluate(
      metadataFixture({ sourceCategory: KnowledgeSourceCategory.DOCUMENT }),
      contextFixture(),
    );
    expect(violations).toHaveLength(1);
  });

  it("evaluate flags a category in deniedCategories", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(policyFixture({ deniedCategories: [KnowledgeSourceCategory.DOCUMENT] }));
    const violations = policy.evaluate(
      metadataFixture({ sourceCategory: KnowledgeSourceCategory.DOCUMENT }),
      contextFixture(),
    );
    expect(violations).toHaveLength(1);
  });

  it("ignores a disabled policy", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(
      policyFixture({ enabled: false, deniedCategories: [KnowledgeSourceCategory.DOCUMENT] }),
    );
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("ignores a policy scoped to a different tenant", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(
      policyFixture({
        scope: { tenantId: "other-tenant" },
        deniedCategories: [KnowledgeSourceCategory.DOCUMENT],
      }),
    );
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("applies a policy scoped to a specific workspace only when it matches", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(
      policyFixture({
        scope: { tenantId: "tenant-1", workspaceId: "workspace-1" },
        deniedCategories: [KnowledgeSourceCategory.DOCUMENT],
      }),
    );
    expect(
      policy.evaluate(metadataFixture(), contextFixture({ workspaceId: "workspace-1" })),
    ).toHaveLength(1);
    expect(
      policy.evaluate(metadataFixture(), contextFixture({ workspaceId: "workspace-2" })),
    ).toEqual([]);
  });

  it("applicablePolicies filters by scope", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register(policyFixture());
    expect(policy.applicablePolicies(contextFixture())).toHaveLength(1);
  });
});
