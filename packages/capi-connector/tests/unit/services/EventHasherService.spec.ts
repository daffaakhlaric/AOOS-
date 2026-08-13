import { createHash } from "node:crypto";

import { err } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import {
  EventHasherService,
  hashCountry,
  hashName,
  hashPhone,
  normalizeName,
  normalizePhone,
} from "../../../src/application/services/EventHasherService.js";
import { HashedName } from "../../../src/domain/value-objects/HashedName.js";
import { HashedPhone } from "../../../src/domain/value-objects/HashedPhone.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("pure hash functions", () => {
  describe("hashPhone", () => {
    it('hashPhone("+628123456789") -> correct sha256 (exact hex)', () => {
      expect(hashPhone("+628123456789")).toBe(sha256("628123456789"));
    });

    it('hashPhone("628123456789") -> same as "+628123456789"', () => {
      expect(hashPhone("628123456789")).toBe(hashPhone("+628123456789"));
    });

    it('hashPhone("08123456789") -> same (normalize first, strip leading 0 is NOT performed — only + and non-digits)', () => {
      // normalizePhone only strips a leading "+" and non-digit characters; it does not
      // rewrite a local "0" prefix to "62". A raw "08123456789" therefore hashes as
      // "08123456789" verbatim, distinct from "628123456789" — callers are expected to pass
      // already-E.164 phone numbers (as `PhoneNumber.toString()` / lead-store guarantees).
      expect(hashPhone("08123456789")).toBe(sha256("08123456789"));
    });

    it("strips non-digit separators (spaces, dashes, parens)", () => {
      expect(hashPhone("+62 812-3456-789")).toBe(sha256("628123456789"));
    });
  });

  describe("hashName", () => {
    it('hashName("Budi Santoso") -> sha256("budi santoso") (lowercase)', () => {
      expect(hashName("Budi Santoso")).toBe(sha256("budi santoso"));
    });

    it("trims leading/trailing whitespace", () => {
      expect(hashName("  Budi Santoso  ")).toBe(sha256("budi santoso"));
    });
  });

  describe("hashCountry", () => {
    it('hashCountry() -> sha256("id") (exact)', () => {
      expect(hashCountry()).toBe(sha256("id"));
    });
  });

  describe("normalizePhone / normalizeName", () => {
    it("normalizePhone strips a leading + and non-digit chars", () => {
      expect(normalizePhone("+62 812-3456-789")).toBe("628123456789");
    });

    it("normalizeName lowercases and trims", () => {
      expect(normalizeName("  Budi Santoso  ")).toBe("budi santoso");
    });
  });
});

describe("EventHasherService", () => {
  const hasher = new EventHasherService();

  it("hashPhone returns a HashedPhone wrapping the exact sha256 digest", () => {
    const hashed = unwrap(hasher.hashPhone("+628123456789"));
    expect(hashed.value).toBe(sha256("628123456789"));
  });

  it("hashPhone rejects an empty/unhashable phone", () => {
    const error = unwrapErr(hasher.hashPhone(""));
    expect(error.name).toBe("HashingError");
    expect(error.message).toContain("Cannot hash an empty/invalid phone number");
  });

  it("hashPhone rejects a phone with no digits at all", () => {
    expect(hasher.hashPhone("+---").ok).toBe(false);
  });

  it("hashName returns a HashedName wrapping the exact sha256 digest", () => {
    const hashed = unwrap(hasher.hashName("Budi Santoso"));
    expect(hashed.value).toBe(sha256("budi santoso"));
  });

  it("hashName rejects an empty/whitespace-only name", () => {
    const error = unwrapErr(hasher.hashName("   "));
    expect(error.message).toContain("Cannot hash an empty name");
  });

  it("hashCountry returns the exact sha256('id') digest", () => {
    expect(hasher.hashCountry()).toBe(sha256("id"));
  });

  it("hashPhone wraps a HashedPhone.create validation failure as HashingError (defensive path — sha256Hex always produces a valid digest in practice)", () => {
    const spy = vi
      .spyOn(HashedPhone, "create")
      .mockReturnValueOnce(err(new ValidationError("bad digest")));
    const error = unwrapErr(hasher.hashPhone("+628123456789"));
    expect(error.name).toBe("HashingError");
    expect(error.message).toBe("bad digest");
    spy.mockRestore();
  });

  it("hashName wraps a HashedName.create validation failure as HashingError (defensive path)", () => {
    const spy = vi
      .spyOn(HashedName, "create")
      .mockReturnValueOnce(err(new ValidationError("bad digest")));
    const error = unwrapErr(hasher.hashName("Budi Santoso"));
    expect(error.name).toBe("HashingError");
    expect(error.message).toBe("bad digest");
    spy.mockRestore();
  });
});
