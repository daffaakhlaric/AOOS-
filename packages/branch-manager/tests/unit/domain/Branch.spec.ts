import { describe, expect, it } from "vitest";

import { Branch } from "../../../src/domain/entities/Branch.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("Branch entity", () => {
  it("creates with valid props", () => {
    const branch = unwrap(
      Branch.create({
        id: BranchId.BINTARO,
        name: "Mobix Bintaro",
        displayName: "Cabang Bintaro",
        active: true,
      }),
    );
    expect(branch.id).toBe(BranchId.BINTARO);
    expect(branch.name).toBe("Mobix Bintaro");
    expect(branch.displayName).toBe("Cabang Bintaro");
    expect(branch.active).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(
      unwrapErr(
        Branch.create({
          id: BranchId.BINTARO,
          name: "  ",
          displayName: "Cabang Bintaro",
          active: true,
        }),
      ).message,
    ).toContain("name must be a non-empty string");
  });

  it("rejects an empty displayName", () => {
    expect(
      unwrapErr(
        Branch.create({
          id: BranchId.BINTARO,
          name: "Mobix Bintaro",
          displayName: "",
          active: true,
        }),
      ).message,
    ).toContain("displayName must be a non-empty string");
  });

  it("withActive returns a new immutable instance", () => {
    const branch = unwrap(
      Branch.create({
        id: BranchId.BINTARO,
        name: "Mobix Bintaro",
        displayName: "Cabang Bintaro",
        active: true,
      }),
    );
    const deactivated = branch.withActive(false);
    expect(deactivated.active).toBe(false);
    expect(branch.active).toBe(true);
    expect(deactivated).not.toBe(branch);
  });
});
