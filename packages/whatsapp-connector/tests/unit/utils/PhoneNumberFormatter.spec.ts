import { describe, expect, it } from "vitest";

import { InvalidPhoneNumberError } from "../../../src/domain/errors/InvalidPhoneNumberError.js";
import { normalizeToE164 } from "../../../src/utils/PhoneNumberFormatter.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("normalizeToE164", () => {
  it('"08123456789" -> "+628123456789"', () => {
    expect(unwrap(normalizeToE164("08123456789")).toString()).toBe("+628123456789");
  });

  it('"628123456789" -> "+628123456789"', () => {
    expect(unwrap(normalizeToE164("628123456789")).toString()).toBe("+628123456789");
  });

  it('"+628123456789" -> "+628123456789" (already normalized)', () => {
    expect(unwrap(normalizeToE164("+628123456789")).toString()).toBe("+628123456789");
  });

  it('"8123456789" -> "+628123456789" (bare local number, no prefix)', () => {
    expect(unwrap(normalizeToE164("8123456789")).toString()).toBe("+628123456789");
  });

  it('"0812-3456-789" -> "+628123456789" (dashes stripped)', () => {
    expect(unwrap(normalizeToE164("0812-3456-789")).toString()).toBe("+628123456789");
  });

  it('"+1234567890" -> InvalidPhoneNumberError (not Indonesian)', () => {
    const error = unwrapErr(normalizeToE164("+1234567890"));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(normalizeToE164(""));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("rejects a whitespace-only string", () => {
    const error = unwrapErr(normalizeToE164("   "));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("rejects a non-string input", () => {
    const error = unwrapErr(normalizeToE164(12345 as unknown as string));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("handles spaces as separators, same as dashes", () => {
    expect(unwrap(normalizeToE164("0812 3456 789")).toString()).toBe("+628123456789");
  });

  it("rejects a too-short digit string even with a +62 prefix", () => {
    const error = unwrapErr(normalizeToE164("+621"));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("strips parentheses and dots as well as dashes/spaces", () => {
    expect(unwrap(normalizeToE164("(0812) 3456.789")).toString()).toBe("+628123456789");
  });

  it("rejects a non-numeric, non-phone-shaped garbage string", () => {
    const error = unwrapErr(normalizeToE164("not-a-phone-number"));
    expect(error).toBeInstanceOf(InvalidPhoneNumberError);
  });

  it("error message names the rejected input for a non-Indonesian E.164 number", () => {
    const error = unwrapErr(normalizeToE164("+1234567890"));
    expect(error.message).toContain("+1234567890");
  });
});
