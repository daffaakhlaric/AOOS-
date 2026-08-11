import { Branch } from "@aos/meta-ads-connector";
import { describe, expect, it } from "vitest";

import { AreaPriority } from "../../../../src/domain/value-objects/AreaPriority.js";
import { unwrap } from "../../../helpers/result.js";

describe("AreaPriority", () => {
  it("creates from every known Branch name", () => {
    for (const branch of Object.values(Branch)) {
      expect(unwrap(AreaPriority.create(branch)).toBranch()).toBe(branch);
    }
  });

  it("rejects an unknown branch name", () => {
    expect(AreaPriority.create("ATLANTIS").ok).toBe(false);
  });

  it("rejects a non-string", () => {
    expect(AreaPriority.create(123 as unknown as string).ok).toBe(false);
  });

  it("fromBranch wraps a Branch value directly", () => {
    expect(AreaPriority.fromBranch(Branch.CINERE).toBranch()).toBe(Branch.CINERE);
  });

  it("equals compares by branch", () => {
    const a = unwrap(AreaPriority.create("CINERE"));
    const b = unwrap(AreaPriority.create("CINERE"));
    const c = unwrap(AreaPriority.create("BINTARO"));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
