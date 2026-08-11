import { describe, expect, it } from "vitest";

import {
  ALL_BRANCH_IDS,
  BranchId,
  fromBranch,
  toBranch,
} from "../../../../src/domain/value-objects/BranchId.js";

describe("BranchId (re-export from @aos/branch-manager)", () => {
  it("has 4 branches", () => {
    expect(ALL_BRANCH_IDS).toHaveLength(4);
  });

  it("toBranch()/fromBranch() round-trip for every branch", () => {
    for (const branchId of ALL_BRANCH_IDS) {
      expect(fromBranch(toBranch(branchId))).toBe(branchId);
    }
  });

  it("BINTARO/CINERE/UMUM/BANDUNG are the 4 members", () => {
    expect(new Set(ALL_BRANCH_IDS)).toEqual(
      new Set([BranchId.BINTARO, BranchId.CINERE, BranchId.UMUM, BranchId.BANDUNG]),
    );
  });
});
