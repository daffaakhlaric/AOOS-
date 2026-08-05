import { describe, expect, it } from "vitest";

import { KnowledgeClassification } from "../../src/domain/knowledge-classification.js";
import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { KnowledgePolicyEngine } from "../../src/policy/knowledge-policy-engine.js";
import { KnowledgeRegistry } from "../../src/registry/knowledge-registry.js";
import { assetFixture, scopeFixture } from "../helpers/asset-fixture.js";

function policyFixture(overrides: Partial<Parameters<KnowledgePolicyEngine["register"]>[0]> = {}) {
  return {
    id: "policy-1",
    name: "Test Policy",
    type: KnowledgePolicyType.RETENTION,
    scope: scopeFixture(),
    rule: {},
    enabled: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Policy Test — KnowledgePolicyEngine", () => {
  it("register() then get()/list() return the registered Policy", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    const policy = policyFixture();
    engine.register(policy);
    expect(engine.get(policy.id)).toBe(policy);
    expect(engine.list()).toHaveLength(1);
  });

  it("applicablePolicies() only returns enabled Policies whose scope covers the Asset", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(policyFixture({ id: "p-enabled" }));
    engine.register(policyFixture({ id: "p-disabled", enabled: false }));
    engine.register(
      policyFixture({ id: "p-other-tenant", scope: scopeFixture({ tenantId: "other" }) }),
    );
    const asset = assetFixture();
    expect(engine.applicablePolicies(asset).map((p) => p.id)).toEqual(["p-enabled"]);
  });

  it("applicablePolicies() filters by type when supplied", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(policyFixture({ id: "p-retention", type: KnowledgePolicyType.RETENTION }));
    engine.register(policyFixture({ id: "p-compliance", type: KnowledgePolicyType.COMPLIANCE }));
    const asset = assetFixture();
    expect(
      engine.applicablePolicies(asset, KnowledgePolicyType.COMPLIANCE).map((p) => p.id),
    ).toEqual(["p-compliance"]);
  });

  it("evaluate() flags a Retention Policy violation when the Asset exceeds maxAgeDays", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(policyFixture({ rule: { maxAgeDays: 0 } }));
    const asset = {
      ...assetFixture(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    };
    const violations = engine.evaluate(asset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain("Retention");
  });

  it("evaluate() does not flag a Retention Policy when the Asset is within maxAgeDays", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(policyFixture({ rule: { maxAgeDays: 365 } }));
    const violations = engine.evaluate(assetFixture());
    expect(violations).toHaveLength(0);
  });

  it("evaluate() flags a Classification Policy violation when the Asset exceeds maxClassification", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(
      policyFixture({
        type: KnowledgePolicyType.CLASSIFICATION,
        rule: { maxClassification: KnowledgeClassification.INTERNAL },
      }),
    );
    const asset = assetFixture({ classification: KnowledgeClassification.SECRET });
    const violations = engine.evaluate(asset, KnowledgePolicyType.CLASSIFICATION);
    expect(violations).toHaveLength(1);
  });

  it("evaluate() flags a Compliance Policy violation for missing required tags", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(
      policyFixture({ type: KnowledgePolicyType.COMPLIANCE, rule: { requiredTags: ["gdpr"] } }),
    );
    const violations = engine.evaluate(assetFixture(), KnowledgePolicyType.COMPLIANCE);
    expect(violations).toHaveLength(1);
  });

  it("evaluate() passes a Compliance Policy when required tags are present", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(
      policyFixture({ type: KnowledgePolicyType.COMPLIANCE, rule: { requiredTags: ["gdpr"] } }),
    );
    const violations = engine.evaluate(
      assetFixture({ tags: ["gdpr"] }),
      KnowledgePolicyType.COMPLIANCE,
    );
    expect(violations).toHaveLength(0);
  });

  it("evaluate() flags a Review Policy violation when never reviewed", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(
      policyFixture({ type: KnowledgePolicyType.REVIEW, rule: { maxDaysSinceReview: 30 } }),
    );
    const violations = engine.evaluate(assetFixture(), KnowledgePolicyType.REVIEW);
    expect(violations[0]?.message).toContain("never been reviewed");
  });

  it("evaluate() flags a Review Policy violation when the review is stale", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(
      policyFixture({ type: KnowledgePolicyType.REVIEW, rule: { maxDaysSinceReview: 1 } }),
    );
    const asset = assetFixture();
    const stale = {
      ...asset,
      metadata: {
        ...asset.metadata,
        reviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      },
    };
    const violations = engine.evaluate(stale, KnowledgePolicyType.REVIEW);
    expect(violations).toHaveLength(1);
  });

  it("evaluate() returns no violations for Policy types with no structural rule (e.g. Access)", () => {
    const engine = new KnowledgePolicyEngine(new KnowledgeRegistry());
    engine.register(policyFixture({ type: KnowledgePolicyType.ACCESS }));
    expect(engine.evaluate(assetFixture(), KnowledgePolicyType.ACCESS)).toEqual([]);
  });
});
