import { describe, expect, it } from "vitest";

import { PhoneNumber } from "../../../src/domain/value-objects/PhoneNumber.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("PhoneNumber", () => {
  it("accepts an already-normalized +62 E.164 number", () => {
    const phone = unwrap(PhoneNumber.create("+628123456789"));
    expect(phone.toString()).toBe("+628123456789");
  });

  it("rejects a number missing the +62 prefix", () => {
    const error = unwrapErr(PhoneNumber.create("08123456789"));
    expect(error.message).toContain("E.164");
  });

  it("rejects a non-Indonesian E.164 number", () => {
    const error = unwrapErr(PhoneNumber.create("+1234567890"));
    expect(error).toBeDefined();
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(PhoneNumber.create(12345 as unknown as string));
    expect(error).toBeDefined();
  });

  it("equals compares by value", () => {
    const a = unwrap(PhoneNumber.create("+628123456789"));
    const b = unwrap(PhoneNumber.create("+628123456789"));
    const c = unwrap(PhoneNumber.create("+628999999999"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
