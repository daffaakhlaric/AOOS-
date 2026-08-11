import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { detectBranch } from "../../../src/utils/BranchDetector.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("detectBranch", () => {
  it.each([
    ["Bintaro", Branch.BINTARO],
    ["Cinere", Branch.CINERE],
    ["Bandung", Branch.BANDUNG],
    ["Umum", Branch.UMUM],
    ["Boost", Branch.BOOST],
    ["Multi", Branch.MULTI],
    ["Jabodetabek", Branch.JABODETABEK],
  ])("maps %s to %s", (raw, expected) => {
    expect(unwrap(detectBranch(raw))).toBe(expected);
  });

  it("is case-insensitive", () => {
    expect(unwrap(detectBranch("bintaro"))).toBe(Branch.BINTARO);
    expect(unwrap(detectBranch("BANDUNG"))).toBe(Branch.BANDUNG);
  });

  it('maps "Pondok Bambu" to Branch.UMUM (documented alias — see report)', () => {
    expect(unwrap(detectBranch("Pondok Bambu"))).toBe(Branch.UMUM);
  });

  it("trims surrounding whitespace", () => {
    expect(unwrap(detectBranch("  Cinere  "))).toBe(Branch.CINERE);
  });

  it("rejects an empty string", () => {
    const error = unwrapErr(detectBranch(""));
    expect(error.message).toContain("non-empty string");
  });

  it("rejects an unrecognized branch name", () => {
    const error = unwrapErr(detectBranch("Jakarta Pusat"));
    expect(error.message).toContain("Unrecognized branch");
  });
});
