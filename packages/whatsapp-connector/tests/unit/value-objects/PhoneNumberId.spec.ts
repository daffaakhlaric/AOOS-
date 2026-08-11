import { describe, expect, it } from "vitest";

import { PhoneNumberId } from "../../../src/domain/value-objects/PhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("PhoneNumberId", () => {
  it("creates from a non-empty string", () => {
    const id = unwrap(PhoneNumberId.create("100000000000001"));
    expect(id.toString()).toBe("100000000000001");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(PhoneNumberId.create(""));
    expect(error.message).toContain("non-empty");
  });

  it("equals compares by value", () => {
    const a = unwrap(PhoneNumberId.create("1"));
    const b = unwrap(PhoneNumberId.create("1"));
    const c = unwrap(PhoneNumberId.create("2"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
