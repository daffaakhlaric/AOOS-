import { describe, expect, it } from "vitest";

import {
  BUDGET_FOLLOW_UP,
  DISCOVERY_POOL,
  getBudgetFollowUp,
  getDiscoveryQuestion,
} from "../../../src/responses/DiscoveryResponses.js";

describe("DiscoveryResponses", () => {
  it("DISCOVERY_POOL entries stay ≤ 300 chars", () => {
    for (const entry of DISCOVERY_POOL) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("getDiscoveryQuestion() returns a pool member", () => {
    expect(DISCOVERY_POOL).toContain(getDiscoveryQuestion(0));
  });

  it("BUDGET_FOLLOW_UP entries stay ≤ 300 chars", () => {
    for (const entry of BUDGET_FOLLOW_UP) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("getBudgetFollowUp() returns a pool member", () => {
    expect(BUDGET_FOLLOW_UP).toContain(getBudgetFollowUp(1));
  });
});
