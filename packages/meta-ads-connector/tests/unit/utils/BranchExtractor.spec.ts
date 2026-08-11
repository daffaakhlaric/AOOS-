import { describe, expect, it } from "vitest";

import { Branch } from "../../../src/domain/value-objects/Branch.js";
import { extractBranch } from "../../../src/utils/BranchExtractor.js";

describe("extractBranch", () => {
  it("extracts CINERE (case-sensitive)", () => {
    expect(extractBranch("CTWA - Cinere - Test Drive")).toBe(Branch.CINERE);
  });

  it("does NOT extract CINERE for the lowercase 'cinere' (city names are case-sensitive)", () => {
    expect(extractBranch("ctwa cinere campaign")).toBe(Branch.UMUM);
  });

  it("extracts BINTARO (case-sensitive)", () => {
    expect(extractBranch("AdSet - Bintaro - Broad")).toBe(Branch.BINTARO);
  });

  it("does NOT extract BINTARO for the lowercase 'bintaro'", () => {
    expect(extractBranch("bintaro promo")).toBe(Branch.UMUM);
  });

  it("extracts BANDUNG (case-sensitive)", () => {
    expect(extractBranch("Campaign - Bandung - Weekend")).toBe(Branch.BANDUNG);
  });

  it("does NOT extract BANDUNG for the lowercase 'bandung'", () => {
    expect(extractBranch("bandung sale")).toBe(Branch.UMUM);
  });

  it("extracts BOOST for uppercase 'Boost' (case-insensitive)", () => {
    expect(extractBranch("Boost Post Campaign")).toBe(Branch.BOOST);
  });

  it("extracts BOOST for lowercase 'boost' (case-insensitive)", () => {
    expect(extractBranch("boost engagement")).toBe(Branch.BOOST);
  });

  it("extracts MULTI for lowercase 'multi' (case-insensitive)", () => {
    expect(extractBranch("multi branch campaign")).toBe(Branch.MULTI);
  });

  it("extracts MULTI for capitalized 'Multi' (case-insensitive)", () => {
    expect(extractBranch("Multi Cabang Promo")).toBe(Branch.MULTI);
  });

  it("falls back to UMUM when no pattern matches", () => {
    expect(extractBranch("Generic Campaign Name")).toBe(Branch.UMUM);
  });

  it("falls back to UMUM for an empty string", () => {
    expect(extractBranch("")).toBe(Branch.UMUM);
  });

  it("first-match-wins: Cinere takes precedence over Bintaro when both are present", () => {
    expect(extractBranch("Cinere and Bintaro combo")).toBe(Branch.CINERE);
  });

  it("first-match-wins: Bandung takes precedence over Boost when both are present", () => {
    expect(extractBranch("Bandung Boost Campaign")).toBe(Branch.BANDUNG);
  });

  it("first-match-wins: Boost takes precedence over Multi when both are present", () => {
    expect(extractBranch("boost multi campaign")).toBe(Branch.BOOST);
  });
});
