import { describe, expect, it } from "vitest";

import { getGreeting, GREETING_POOL } from "../../../src/responses/GreetingResponses.js";

describe("GreetingResponses", () => {
  it("GREETING_POOL has 3 entries, each ≤ 300 chars", () => {
    expect(GREETING_POOL).toHaveLength(3);
    for (const entry of GREETING_POOL) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });

  it("getGreeting() always returns a pool member", () => {
    for (let seed = 0; seed < 6; seed += 1) {
      expect(GREETING_POOL).toContain(getGreeting(seed));
    }
  });
});
