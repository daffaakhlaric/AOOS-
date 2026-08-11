import { describe, expect, it } from "vitest";

import { BranchConfigBuilder } from "../../../src/builders/BranchConfigBuilder.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { BranchRegistry } from "../../../src/registry/BranchRegistry.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function build4Branches() {
  return [
    unwrap(
      new BranchConfigBuilder()
        .withId(BranchId.BINTARO)
        .withWabaPhoneNumberId("PHONE_NUMBER_ID_BINTARO")
        .build(),
    ),
    unwrap(
      new BranchConfigBuilder()
        .withId(BranchId.CINERE)
        .withWabaPhoneNumberId("PHONE_NUMBER_ID_CINERE")
        .build(),
    ),
    unwrap(
      new BranchConfigBuilder()
        .withId(BranchId.UMUM)
        .withWabaPhoneNumberId("PHONE_NUMBER_ID_PONDOK_BAMBU")
        .build(),
    ),
    unwrap(
      new BranchConfigBuilder()
        .withId(BranchId.BANDUNG)
        .withWabaPhoneNumberId("PHONE_NUMBER_ID_BANDUNG")
        .build(),
    ),
  ];
}

describe("BranchRegistry", () => {
  it("registers all 4 branches on init", () => {
    const registry = new BranchRegistry(build4Branches());
    expect(registry.getAll()).toHaveLength(4);
  });

  it("getByBranchId returns the correct BranchConfig", () => {
    const registry = new BranchRegistry(build4Branches());
    const config = unwrap(registry.getByBranchId(BranchId.BANDUNG));
    expect(config.id).toBe(BranchId.BANDUNG);
  });

  it("getByBranchId returns BranchNotFoundError for an unregistered id", () => {
    const registry = new BranchRegistry([]);
    expect(unwrapErr(registry.getByBranchId(BranchId.BINTARO)).message).toContain(
      "No branch registered",
    );
  });

  it("getByPhoneNumberId returns the correct BranchConfig", () => {
    const registry = new BranchRegistry(build4Branches());
    const config = unwrap(registry.getByPhoneNumberId("PHONE_NUMBER_ID_PONDOK_BAMBU"));
    expect(config.id).toBe(BranchId.UMUM);
  });

  it("getByPhoneNumberId returns BranchNotFoundError for an unknown phoneNumberId", () => {
    const registry = new BranchRegistry(build4Branches());
    expect(unwrapErr(registry.getByPhoneNumberId("unknown")).message).toContain(
      "No branch registered",
    );
  });

  describe("update", () => {
    it("replaces an existing branch's config", () => {
      const registry = new BranchRegistry(build4Branches());
      const updated = unwrap(registry.getByBranchId(BranchId.BINTARO)).withAssignmentMode(
        AssignmentMode.ROUND_ROBIN,
      );
      const result = unwrap(registry.update(updated));
      expect(result.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
      expect(unwrap(registry.getByBranchId(BranchId.BINTARO)).assignmentMode).toBe(
        AssignmentMode.ROUND_ROBIN,
      );
    });

    it("re-indexes by the new phoneNumberId after update", () => {
      const registry = new BranchRegistry(build4Branches());
      const updated = unwrap(
        new BranchConfigBuilder()
          .withId(BranchId.BINTARO)
          .withWabaPhoneNumberId("PHONE_NUMBER_ID_BINTARO_V2")
          .build(),
      );
      unwrap(registry.update(updated));
      expect(unwrap(registry.getByPhoneNumberId("PHONE_NUMBER_ID_BINTARO_V2")).id).toBe(
        BranchId.BINTARO,
      );
      expect(registry.getByPhoneNumberId("PHONE_NUMBER_ID_BINTARO").ok).toBe(false);
    });

    it("fails with BranchConfigError for an unregistered branch id", () => {
      const registry = new BranchRegistry([]);
      const config = unwrap(new BranchConfigBuilder().build());
      expect(unwrapErr(registry.update(config)).message).toContain(
        "Cannot update unregistered branch",
      );
    });
  });
});
