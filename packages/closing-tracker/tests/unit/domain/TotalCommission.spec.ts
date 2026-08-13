import { describe, expect, it } from "vitest";

import { TotalCommission } from "../../../src/domain/value-objects/TotalCommission.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("TotalCommission", () => {
  it("rejects a negative amount", () => {
    const error = unwrapErr(TotalCommission.create(-1));
    expect(error.message).toContain("non-negative");
  });

  it("accepts a valid non-negative amount", () => {
    expect(unwrap(TotalCommission.create(1_000_000)).value).toBe(1_000_000);
  });

  it("zero() -> 0", () => {
    expect(TotalCommission.zero().value).toBe(0);
  });

  describe("fromAmounts (pinned business correctness)", () => {
    it("spk1=5_850_000, spk2=4_200_000 -> total=10_050_000 (exact)", () => {
      expect(TotalCommission.fromAmounts([5_850_000, 4_200_000]).value).toBe(10_050_000);
    });

    it("treats undefined entries as 0", () => {
      expect(TotalCommission.fromAmounts([1_000_000, undefined, 500_000]).value).toBe(1_500_000);
    });

    it("empty list -> 0", () => {
      expect(TotalCommission.fromAmounts([]).value).toBe(0);
    });
  });
});
