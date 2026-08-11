import { describe, expect, it } from "vitest";

import { getHandoffResponse, handoffPool } from "../../../src/responses/HandoffResponses.js";

describe("HandoffResponses", () => {
  it("handoffPool() includes the sales name and stays ≤ 300 chars", () => {
    const pool = handoffPool("Budi Santoso");
    expect(pool[0]).toContain("Budi Santoso");
    expect(pool[0]!.length).toBeLessThanOrEqual(300);
  });

  it("getHandoffResponse() delegates to the pool", () => {
    expect(getHandoffResponse("Budi Santoso", 0)).toContain("Budi Santoso");
  });
});
