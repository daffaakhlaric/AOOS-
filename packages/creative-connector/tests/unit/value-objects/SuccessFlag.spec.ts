import { describe, expect, it } from "vitest";

import { SuccessFlag, parseSuccessFlag } from "../../../src/domain/value-objects/SuccessFlag.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("SuccessFlag", () => {
  it("0 -> PENDING (still generating)", () => {
    const flag = unwrap(parseSuccessFlag(0));
    expect(flag).toBe(SuccessFlag.PENDING);
  });

  it("1 -> SUCCESS", () => {
    const flag = unwrap(parseSuccessFlag(1));
    expect(flag).toBe(SuccessFlag.SUCCESS);
  });

  it("2 -> FAILED", () => {
    const flag = unwrap(parseSuccessFlag(2));
    expect(flag).toBe(SuccessFlag.FAILED);
  });

  it("3 -> GEN_FAILED", () => {
    const flag = unwrap(parseSuccessFlag(3));
    expect(flag).toBe(SuccessFlag.GEN_FAILED);
  });

  it("rejects an out-of-range number", () => {
    const error = unwrapErr(parseSuccessFlag(4));
    expect(error.message).toMatch(/successFlag must be one of 0, 1, 2, 3/);
  });

  it("rejects a non-number value", () => {
    const error = unwrapErr(parseSuccessFlag("1" as unknown as number));
    expect(error.message).toMatch(/successFlag must be one of 0, 1, 2, 3/);
  });

  it("FAILED (2) and GEN_FAILED (3) are distinct enum members (design resolution #4)", () => {
    expect(SuccessFlag.FAILED).not.toBe(SuccessFlag.GEN_FAILED);
  });
});
