import { describe, expect, it } from "vitest";

import { PolicyUpdateStrategy } from "../../src/strategies/policy-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("PolicyUpdateStrategy", () => {
  it("declares updateType Policy", () => {
    expect(new PolicyUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Policy);
  });

  it("tags the applied payload with policyUpdated", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new PolicyUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1, policyUpdated: true });
  });

  it("reports success = true for an empty payload", () => {
    const task = makeTask({ payload: {} });
    const result = new PolicyUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
  });
});
