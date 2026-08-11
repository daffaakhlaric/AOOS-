import { describe, expect, it } from "vitest";

import { BranchId } from "../../src/domain/value-objects/BranchId.js";
import { BranchManagerFactory } from "../../src/factories/BranchManagerFactory.js";
import { makeBranchManagerConfig } from "../fixtures/branchManagerFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

describe("DetectBranch integration (via BranchManagerFactory)", () => {
  it("PHONE_NUMBER_ID_BINTARO -> BranchId.BINTARO", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    expect(unwrap(manager.detectBranch.execute({ phoneNumberId: "PHONE_NUMBER_ID_BINTARO" }))).toBe(
      BranchId.BINTARO,
    );
  });

  it("PHONE_NUMBER_ID_CINERE -> BranchId.CINERE", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    expect(unwrap(manager.detectBranch.execute({ phoneNumberId: "PHONE_NUMBER_ID_CINERE" }))).toBe(
      BranchId.CINERE,
    );
  });

  it("PHONE_NUMBER_ID_PONDOK_BAMBU -> BranchId.UMUM (the resolved mapping)", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    expect(
      unwrap(manager.detectBranch.execute({ phoneNumberId: "PHONE_NUMBER_ID_PONDOK_BAMBU" })),
    ).toBe(BranchId.UMUM);
  });

  it("PHONE_NUMBER_ID_BANDUNG -> BranchId.BANDUNG", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    expect(unwrap(manager.detectBranch.execute({ phoneNumberId: "PHONE_NUMBER_ID_BANDUNG" }))).toBe(
      BranchId.BANDUNG,
    );
  });

  it("unknown -> BranchNotFoundError", () => {
    const manager = BranchManagerFactory.create({
      config: makeBranchManagerConfig(),
      publisher: createFakePublisher(),
    });
    expect(unwrapErr(manager.detectBranch.execute({ phoneNumberId: "unknown" })).message).toContain(
      "No branch registered",
    );
  });
});
