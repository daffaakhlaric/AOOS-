import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { HashedPhone } from "../../../../src/domain/value-objects/HashedPhone.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("HashedPhone", () => {
  it("accepts a valid 64-character lowercase hex sha256 digest", () => {
    const hex = createHash("sha256").update("628123456789").digest("hex");
    const hashed = unwrap(HashedPhone.create(hex));
    expect(hashed.value).toBe(hex);
  });

  it("rejects a non-hex string", () => {
    const error = unwrapErr(HashedPhone.create("not-hex"));
    expect(error.message).toContain(
      "HashedPhone must be a 64-character lowercase hex sha256 digest",
    );
  });

  it("rejects uppercase hex", () => {
    const hex = createHash("sha256").update("x").digest("hex").toUpperCase();
    expect(HashedPhone.create(hex).ok).toBe(false);
  });

  it("rejects a digest of the wrong length", () => {
    expect(HashedPhone.create("abcd").ok).toBe(false);
  });
});
