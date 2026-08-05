import { describe, expect, it } from "vitest";

import { KnowledgePolicyType } from "../../src/domain/knowledge-policy-type.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";

describe("Validator Test — PolicyValidator", () => {
  it("passes when no policy is supplied", () => {
    expect(new PolicyValidator().validate({}).valid).toBe(true);
  });

  it("passes for a disabled Policy with an empty rule", () => {
    const result = new PolicyValidator().validate({
      policy: {
        id: "p-1",
        name: "x",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: {},
        enabled: false,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags an enabled Policy with an empty rule", () => {
    const result = new PolicyValidator().validate({
      policy: {
        id: "p-1",
        name: "x",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: {},
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes for an enabled Policy with a non-empty rule", () => {
    const result = new PolicyValidator().validate({
      policy: {
        id: "p-1",
        name: "x",
        type: KnowledgePolicyType.RETENTION,
        scope: { tenantId: "t1" },
        rule: { maxAgeDays: 30 },
        enabled: true,
        createdAt: new Date().toISOString(),
      },
    });
    expect(result.valid).toBe(true);
  });
});
