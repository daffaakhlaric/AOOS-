import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { HashedName } from "../../../../src/domain/value-objects/HashedName.js";
import { unwrap, unwrapErr } from "../../../helpers/result.js";

describe("HashedName", () => {
  it("accepts a valid 64-character lowercase hex sha256 digest", () => {
    const hex = createHash("sha256").update("budi santoso").digest("hex");
    const hashed = unwrap(HashedName.create(hex));
    expect(hashed.value).toBe(hex);
  });

  it("rejects a non-hex string", () => {
    const error = unwrapErr(HashedName.create("nope"));
    expect(error.message).toContain(
      "HashedName must be a 64-character lowercase hex sha256 digest",
    );
  });

  it("rejects the empty string", () => {
    expect(HashedName.create("").ok).toBe(false);
  });
});
