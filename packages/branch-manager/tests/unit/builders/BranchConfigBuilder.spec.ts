import { describe, expect, it } from "vitest";

import { BranchConfigBuilder } from "../../../src/builders/BranchConfigBuilder.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("BranchConfigBuilder", () => {
  it("builds with sensible defaults", () => {
    const config = unwrap(new BranchConfigBuilder().build());
    expect(config.id).toBe(BranchId.BINTARO);
    expect(config.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(config.maxLeadsPerSalesPerDay.toNumber()).toBe(10);
    expect(config.active).toBe(true);
  });

  it("applies every with-method override", () => {
    const config = unwrap(
      new BranchConfigBuilder()
        .withId(BranchId.BANDUNG)
        .withName("Mobix Bandung")
        .withDisplayName("Cabang Bandung")
        .withWabaPhoneNumberId("PHONE_NUMBER_ID_BANDUNG")
        .withWabaPhoneNumber("+628110000004")
        .withAssignmentMode(AssignmentMode.ROUND_ROBIN)
        .withMaxLeadsPerSalesPerDay(8)
        .withManagerWaNumber("+628990000001")
        .withActive(false)
        .build(),
    );
    expect(config.id).toBe(BranchId.BANDUNG);
    expect(config.name).toBe("Mobix Bandung");
    expect(config.displayName).toBe("Cabang Bandung");
    expect(config.wabaPhoneNumberId.toString()).toBe("PHONE_NUMBER_ID_BANDUNG");
    expect(config.wabaPhoneNumber).toBe("+628110000004");
    expect(config.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
    expect(config.maxLeadsPerSalesPerDay.toNumber()).toBe(8);
    expect(config.managerWaNumber).toBe("+628990000001");
    expect(config.active).toBe(false);
  });

  it("propagates an invalid wabaPhoneNumberId", () => {
    expect(
      unwrapErr(new BranchConfigBuilder().withWabaPhoneNumberId("").build()).message,
    ).toContain("PhoneNumberId");
  });

  it("propagates an invalid maxLeadsPerSalesPerDay", () => {
    expect(
      unwrapErr(new BranchConfigBuilder().withMaxLeadsPerSalesPerDay(0).build()).message,
    ).toContain("MaxLeadsPerDay");
  });

  it("propagates a BranchConfig.create validation failure (empty name)", () => {
    expect(unwrapErr(new BranchConfigBuilder().withName("").build()).message).toContain(
      "name must be",
    );
  });
});
