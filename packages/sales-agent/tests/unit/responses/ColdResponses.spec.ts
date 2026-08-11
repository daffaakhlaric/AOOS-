import { describe, expect, it } from "vitest";

import { COLD_NURTURE_POOL, getColdNurtureResponse } from "../../../src/responses/ColdResponses.js";

describe("ColdResponses", () => {
  it("getColdNurtureResponse() returns a pool member", () => {
    expect(COLD_NURTURE_POOL).toContain(getColdNurtureResponse(0));
  });

  it("every response stays ≤ 300 chars", () => {
    for (const entry of COLD_NURTURE_POOL) {
      expect(entry.length).toBeLessThanOrEqual(300);
    }
  });
});
