import { describe, expect, it } from "vitest";

import { DetectBranch } from "../../../src/application/use-cases/DetectBranch.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { BranchRegistry } from "../../../src/registry/BranchRegistry.js";
import { makeBranchConfig } from "../../fixtures/branchManagerFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("DetectBranch", () => {
  it("PHONE_NUMBER_ID_BINTARO -> BranchId.BINTARO", () => {
    const registry = new BranchRegistry([
      makeBranchConfig({ id: BranchId.BINTARO, wabaPhoneNumberId: "PHONE_NUMBER_ID_BINTARO" }),
    ]);
    const useCase = new DetectBranch(registry);
    expect(unwrap(useCase.execute({ phoneNumberId: "PHONE_NUMBER_ID_BINTARO" }))).toBe(
      BranchId.BINTARO,
    );
  });

  it("PHONE_NUMBER_ID_CINERE -> BranchId.CINERE", () => {
    const registry = new BranchRegistry([
      makeBranchConfig({ id: BranchId.CINERE, wabaPhoneNumberId: "PHONE_NUMBER_ID_CINERE" }),
    ]);
    const useCase = new DetectBranch(registry);
    expect(unwrap(useCase.execute({ phoneNumberId: "PHONE_NUMBER_ID_CINERE" }))).toBe(
      BranchId.CINERE,
    );
  });

  it("unknown -> BranchNotFoundError", () => {
    const registry = new BranchRegistry([]);
    const useCase = new DetectBranch(registry);
    expect(unwrapErr(useCase.execute({ phoneNumberId: "unknown" })).message).toContain(
      "No branch registered",
    );
  });
});
