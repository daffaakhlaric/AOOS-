import { describe, expect, it } from "vitest";

import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { PolicyFactory } from "../../src/factory/policy-factory.js";

describe("Factory Test — PolicyFactory", () => {
  it("defaults enabled to true", () => {
    const policy = new PolicyFactory().create({
      name: "Retention",
      type: KnowledgePolicyType.RETENTION,
      scope: { tenantId: "t1" },
    });
    expect(policy.enabled).toBe(true);
    expect(policy.rule).toEqual({});
    expect(policy.id).toEqual(expect.any(String));
  });

  it("accepts an explicit enabled flag and rule", () => {
    const policy = new PolicyFactory().create({
      name: "Compliance",
      type: KnowledgePolicyType.COMPLIANCE,
      scope: { tenantId: "t1" },
      rule: { requiredTags: ["gdpr"] },
      enabled: false,
    });
    expect(policy.enabled).toBe(false);
    expect(policy.rule).toEqual({ requiredTags: ["gdpr"] });
  });
});
