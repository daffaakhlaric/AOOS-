import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import {
  ALL_BRANCH_IDS,
  BranchId,
  fromBranch,
  toBranch,
} from "../../../src/domain/value-objects/BranchId.js";

describe("BranchId", () => {
  it("has exactly 4 members matching DSS Motor's real branches", () => {
    expect(Object.values(BranchId).sort()).toEqual(["BANDUNG", "BINTARO", "CINERE", "UMUM"].sort());
  });

  it("uses UMUM in place of the nonexistent Branch.PONDOK_BAMBU", () => {
    expect(BranchId.UMUM).toBe("UMUM");
    expect((Branch as Record<string, string>).PONDOK_BAMBU).toBeUndefined();
  });

  it("ALL_BRANCH_IDS lists all 4 members in DSS Motor canonical order", () => {
    expect(ALL_BRANCH_IDS).toEqual([
      BranchId.BINTARO,
      BranchId.CINERE,
      BranchId.UMUM,
      BranchId.BANDUNG,
    ]);
  });

  describe("toBranch", () => {
    it("converts BINTARO", () => {
      expect(toBranch(BranchId.BINTARO)).toBe(Branch.BINTARO);
    });
    it("converts CINERE", () => {
      expect(toBranch(BranchId.CINERE)).toBe(Branch.CINERE);
    });
    it("converts UMUM", () => {
      expect(toBranch(BranchId.UMUM)).toBe(Branch.UMUM);
    });
    it("converts BANDUNG", () => {
      expect(toBranch(BranchId.BANDUNG)).toBe(Branch.BANDUNG);
    });
  });

  describe("fromBranch", () => {
    it("converts Branch.BINTARO", () => {
      expect(fromBranch(Branch.BINTARO)).toBe(BranchId.BINTARO);
    });
    it("converts Branch.CINERE", () => {
      expect(fromBranch(Branch.CINERE)).toBe(BranchId.CINERE);
    });
    it("converts Branch.UMUM", () => {
      expect(fromBranch(Branch.UMUM)).toBe(BranchId.UMUM);
    });
    it("converts Branch.BANDUNG", () => {
      expect(fromBranch(Branch.BANDUNG)).toBe(BranchId.BANDUNG);
    });
    it("returns undefined for Branch.BOOST (no DSS Motor branch-manager meaning)", () => {
      expect(fromBranch(Branch.BOOST)).toBeUndefined();
    });
    it("returns undefined for Branch.MULTI", () => {
      expect(fromBranch(Branch.MULTI)).toBeUndefined();
    });
    it("returns undefined for Branch.JABODETABEK", () => {
      expect(fromBranch(Branch.JABODETABEK)).toBeUndefined();
    });
  });

  it("BranchId values are string-identical to their Branch counterparts (trivial interop)", () => {
    expect(BranchId.BINTARO as string).toBe(Branch.BINTARO as string);
    expect(BranchId.CINERE as string).toBe(Branch.CINERE as string);
    expect(BranchId.UMUM as string).toBe(Branch.UMUM as string);
    expect(BranchId.BANDUNG as string).toBe(Branch.BANDUNG as string);
  });
});
