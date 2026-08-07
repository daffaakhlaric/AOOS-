import { describe, expect, it } from "vitest";

import { KnowledgeAutoUpdateException } from "../../src/errors/knowledge-auto-update-exception.js";
import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";

describe("PolicyNotFoundException", () => {
  it("is a KnowledgeAutoUpdateException", () => {
    expect(new PolicyNotFoundException("p-1")).toBeInstanceOf(KnowledgeAutoUpdateException);
  });

  it("sets code POLICY_NOT_FOUND", () => {
    expect(new PolicyNotFoundException("p-1").code).toBe("POLICY_NOT_FOUND");
  });

  it("includes the policy id in message and context", () => {
    const error = new PolicyNotFoundException("p-2");
    expect(error.message).toContain("p-2");
    expect(error.context).toEqual({ policyId: "p-2" });
  });
});
