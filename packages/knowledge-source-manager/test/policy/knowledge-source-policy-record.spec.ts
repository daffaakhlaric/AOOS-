import { describe, expect, it } from "vitest";

import { knowledgeSourcePolicyRecordSchema } from "../../src/policy/knowledge-source-policy-record.js";

describe("knowledgeSourcePolicyRecordSchema", () => {
  it("accepts a minimal enabled policy", () => {
    expect(() =>
      knowledgeSourcePolicyRecordSchema.parse({
        id: "policy-1",
        name: "policy",
        scope: { tenantId: "tenant-1" },
        enabled: true,
        createdAt: new Date().toISOString(),
      }),
    ).not.toThrow();
  });

  it("rejects a missing tenantId in scope", () => {
    expect(() =>
      knowledgeSourcePolicyRecordSchema.parse({
        id: "policy-1",
        name: "policy",
        scope: {},
        enabled: true,
        createdAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
