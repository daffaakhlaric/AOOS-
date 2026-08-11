import { describe, expect, it } from "vitest";

import { FollowUpDay } from "../../../src/domain/value-objects/FollowUpDay.js";
import {
  FOLLOW_UP_D3,
  FOLLOW_UP_D7,
  FOLLOW_UP_D14,
  FOLLOW_UP_WARM_D1,
  getFollowUpMessage,
} from "../../../src/responses/FollowUpResponses.js";

describe("FollowUpResponses", () => {
  it("getFollowUpMessage(D1) returns a FOLLOW_UP_WARM_D1 pool member", () => {
    expect(FOLLOW_UP_WARM_D1).toContain(getFollowUpMessage(FollowUpDay.D1, 0));
  });

  it("getFollowUpMessage(D3) returns a FOLLOW_UP_D3 pool member", () => {
    expect(FOLLOW_UP_D3).toContain(getFollowUpMessage(FollowUpDay.D3, 0));
  });

  it("getFollowUpMessage(D7) returns a FOLLOW_UP_D7 pool member", () => {
    expect(FOLLOW_UP_D7).toContain(getFollowUpMessage(FollowUpDay.D7, 0));
  });

  it("getFollowUpMessage(D14) returns a FOLLOW_UP_D14 pool member", () => {
    expect(FOLLOW_UP_D14).toContain(getFollowUpMessage(FollowUpDay.D14, 0));
  });

  it("every follow-up message stays ≤ 300 chars", () => {
    for (const pool of [FOLLOW_UP_WARM_D1, FOLLOW_UP_D3, FOLLOW_UP_D7, FOLLOW_UP_D14]) {
      for (const entry of pool) {
        expect(entry.length).toBeLessThanOrEqual(300);
      }
    }
  });
});
