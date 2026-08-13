import { describe, expect, it } from "vitest";

import { RphSpk } from "../../../src/domain/value-objects/RphSpk.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("RphSpk", () => {
  it("rejects a negative amount", () => {
    const error = unwrapErr(RphSpk.create(-1));
    expect(error.message).toContain("non-negative");
  });

  it("accepts zero", () => {
    const rphSpk = unwrap(RphSpk.create(0));
    expect(rphSpk.value).toBe(0);
  });

  describe("fromSpendAndSpk (pinned business correctness)", () => {
    it("spend=3_600_000, spk=3 -> rphSpk=1_200_000 (exact)", () => {
      expect(RphSpk.fromSpendAndSpk(3_600_000, 3).value).toBe(1_200_000);
    });

    it("spend=10_000_000, spk=2 -> rphSpk=5_000_000 (exact boundary)", () => {
      expect(RphSpk.fromSpendAndSpk(10_000_000, 2).value).toBe(5_000_000);
    });

    it("spend=10_000_001, spk=2 -> rphSpk=5_000_000.5", () => {
      expect(RphSpk.fromSpendAndSpk(10_000_001, 2).value).toBe(5_000_000.5);
    });

    it("spkCount=0 -> RphSpk(0), never NaN/Infinity", () => {
      const rphSpk = RphSpk.fromSpendAndSpk(2_000_000, 0);
      expect(rphSpk.value).toBe(0);
      expect(Number.isNaN(rphSpk.value)).toBe(false);
      expect(Number.isFinite(rphSpk.value)).toBe(true);
    });

    it("negative spkCount also safely resolves to 0", () => {
      expect(RphSpk.fromSpendAndSpk(1_000_000, -1).value).toBe(0);
    });
  });
});
