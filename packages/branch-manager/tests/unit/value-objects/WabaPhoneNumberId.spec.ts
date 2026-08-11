import { describe, expect, it } from "vitest";

import { WabaPhoneNumberId } from "../../../src/domain/value-objects/WabaPhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("WabaPhoneNumberId", () => {
  it("creates from a valid non-empty string", () => {
    const id = unwrap(WabaPhoneNumberId.create("PHONE_NUMBER_ID_BINTARO"));
    expect(id.toString()).toBe("PHONE_NUMBER_ID_BINTARO");
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(WabaPhoneNumberId.create(""));
    expect(error.message).toContain("PhoneNumberId");
  });

  it("equals compares by value", () => {
    const a = unwrap(WabaPhoneNumberId.create("X"));
    const b = unwrap(WabaPhoneNumberId.create("X"));
    const c = unwrap(WabaPhoneNumberId.create("Y"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
