import { describe, expect, it } from "vitest";

import { FollowUpDay } from "../../../../src/domain/value-objects/FollowUpDay.js";

describe("FollowUpDay", () => {
  it("D1 = 1", () => {
    expect(FollowUpDay.D1).toBe(1);
  });

  it("D3 = 3", () => {
    expect(FollowUpDay.D3).toBe(3);
  });

  it("D7 = 7", () => {
    expect(FollowUpDay.D7).toBe(7);
  });

  it("D14 = 14", () => {
    expect(FollowUpDay.D14).toBe(14);
  });
});
