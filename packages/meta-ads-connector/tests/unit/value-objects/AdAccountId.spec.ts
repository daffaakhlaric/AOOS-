import { describe, expect, it } from "vitest";

import { AdAccountId } from "../../../src/domain/value-objects/AdAccountId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("AdAccountId", () => {
  it("creates a valid AdAccountId from a well-formed raw string", () => {
    const id = unwrap(AdAccountId.create("act_752604553578354"));
    expect(id.toString()).toBe("act_752604553578354");
  });

  it("rejects a string without the act_ prefix", () => {
    expect(unwrapErr(AdAccountId.create("752604553578354")).message).toMatch(/act_/);
  });

  it("rejects a non-numeric suffix", () => {
    expect(AdAccountId.create("act_abc").ok).toBe(false);
  });

  it("rejects a non-string input", () => {
    expect(AdAccountId.create(12345 as unknown as string).ok).toBe(false);
  });

  it("equals returns true for the same value", () => {
    const a = unwrap(AdAccountId.create("act_1"));
    const b = unwrap(AdAccountId.create("act_1"));
    expect(a.equals(b)).toBe(true);
  });

  it("equals returns false for different values", () => {
    const a = unwrap(AdAccountId.create("act_1"));
    const b = unwrap(AdAccountId.create("act_2"));
    expect(a.equals(b)).toBe(false);
  });
});
