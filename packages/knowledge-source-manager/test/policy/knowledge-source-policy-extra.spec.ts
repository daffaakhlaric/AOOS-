import { describe, expect, it } from "vitest";

import { KnowledgeSourceCategory } from "../../src/domain/knowledge-source-category.js";
import { KnowledgeSourcePolicy } from "../../src/policy/knowledge-source-policy.js";
import { KnowledgeSourceRegistry } from "../../src/registry/knowledge-source-registry.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

describe("KnowledgeSourcePolicy additional coverage", () => {
  it("a policy without allowedCategories/deniedCategories never produces violations", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register({
      id: "policy-1",
      name: "unrestricted",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    expect(policy.evaluate(metadataFixture(), contextFixture())).toEqual([]);
  });

  it("re-registering a policy id replaces the prior record", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register({
      id: "policy-1",
      name: "v1",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    policy.register({
      id: "policy-1",
      name: "v2",
      scope: { tenantId: "tenant-1" },
      enabled: false,
      createdAt: new Date().toISOString(),
    });
    expect(policy.applicablePolicies(contextFixture())).toEqual([]);
  });

  it("allowedCategories and deniedCategories can both produce violations for the same policy", () => {
    const registry = new KnowledgeSourceRegistry();
    const policy = new KnowledgeSourcePolicy(registry);
    policy.register({
      id: "policy-1",
      name: "contradictory",
      scope: { tenantId: "tenant-1" },
      enabled: true,
      allowedCategories: [KnowledgeSourceCategory.CRM],
      deniedCategories: [KnowledgeSourceCategory.DOCUMENT],
      createdAt: new Date().toISOString(),
    });
    const violations = policy.evaluate(
      metadataFixture({ sourceCategory: KnowledgeSourceCategory.DOCUMENT }),
      contextFixture(),
    );
    expect(violations).toHaveLength(2);
  });
});
