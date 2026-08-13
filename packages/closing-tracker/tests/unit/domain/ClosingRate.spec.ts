import { describe, expect, it } from "vitest";

import { ClosingRate } from "../../../src/domain/value-objects/ClosingRate.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ClosingRate", () => {
  it("rejects a value above 1.0", () => {
    const error = unwrapErr(ClosingRate.create(1.1));
    expect(error.message).toContain("0.0 and 1.0");
  });

  it("rejects a negative value", () => {
    const error = unwrapErr(ClosingRate.create(-0.1));
    expect(error.message).toContain("0.0 and 1.0");
  });

  it("accepts the 0.0 and 1.0 boundaries", () => {
    expect(unwrap(ClosingRate.create(0)).value).toBe(0);
    expect(unwrap(ClosingRate.create(1)).value).toBe(1);
  });

  describe("fromCounts (pinned business correctness)", () => {
    it("hot_leads=47, spk=12 -> 0.2553... (4 decimal places)", () => {
      const rate = ClosingRate.fromCounts(12, 47);
      expect(rate.value).toBeCloseTo(0.2553, 4);
    });

    it("hot_leads=0 -> 0.0, never NaN", () => {
      const rate = ClosingRate.fromCounts(0, 0);
      expect(rate.value).toBe(0);
      expect(Number.isNaN(rate.value)).toBe(false);
    });

    it("test_drives=5, spk=3 -> rate=0.6 (exact)", () => {
      expect(ClosingRate.fromCounts(3, 5).value).toBe(0.6);
    });

    it("negative denominator safely resolves to 0.0", () => {
      expect(ClosingRate.fromCounts(3, -1).value).toBe(0);
    });
  });
});
