import { describe, expect, it } from "vitest";

import { BranchConfig } from "../../../src/domain/entities/BranchConfig.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { BranchId } from "../../../src/domain/value-objects/BranchId.js";
import { MaxLeadsPerDay } from "../../../src/domain/value-objects/MaxLeadsPerDay.js";
import { WabaPhoneNumberId } from "../../../src/domain/value-objects/WabaPhoneNumberId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validProps() {
  return {
    id: BranchId.BINTARO,
    name: "Mobix Bintaro",
    displayName: "Cabang Bintaro",
    wabaPhoneNumberId: unwrap(WabaPhoneNumberId.create("PHONE_NUMBER_ID_BINTARO")),
    wabaPhoneNumber: "+628110000001",
    assignmentMode: AssignmentMode.SMART_ASSIGN,
    maxLeadsPerSalesPerDay: unwrap(MaxLeadsPerDay.create(10)),
    active: true,
  };
}

describe("BranchConfig entity", () => {
  it("creates with valid props and exposes every getter", () => {
    const config = unwrap(BranchConfig.create(validProps()));
    expect(config.id).toBe(BranchId.BINTARO);
    expect(config.name).toBe("Mobix Bintaro");
    expect(config.displayName).toBe("Cabang Bintaro");
    expect(config.wabaPhoneNumberId.toString()).toBe("PHONE_NUMBER_ID_BINTARO");
    expect(config.wabaPhoneNumber).toBe("+628110000001");
    expect(config.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(config.maxLeadsPerSalesPerDay.toNumber()).toBe(10);
    expect(config.managerWaNumber).toBeUndefined();
    expect(config.active).toBe(true);
  });

  it("accepts an optional managerWaNumber", () => {
    const config = unwrap(
      BranchConfig.create({ ...validProps(), managerWaNumber: "+628990000001" }),
    );
    expect(config.managerWaNumber).toBe("+628990000001");
  });

  it("rejects an empty name", () => {
    expect(unwrapErr(BranchConfig.create({ ...validProps(), name: "" })).message).toContain(
      "name must be",
    );
  });

  it("rejects an empty displayName", () => {
    expect(
      unwrapErr(BranchConfig.create({ ...validProps(), displayName: "  " })).message,
    ).toContain("displayName must be");
  });

  it("rejects an empty wabaPhoneNumber", () => {
    expect(
      unwrapErr(BranchConfig.create({ ...validProps(), wabaPhoneNumber: "" })).message,
    ).toContain("wabaPhoneNumber must be");
  });

  it("rejects an empty managerWaNumber when explicitly set", () => {
    expect(
      unwrapErr(BranchConfig.create({ ...validProps(), managerWaNumber: "" })).message,
    ).toContain("managerWaNumber must not be an empty string");
  });

  it("withAssignmentMode returns a new immutable instance", () => {
    const config = unwrap(BranchConfig.create(validProps()));
    const updated = config.withAssignmentMode(AssignmentMode.ROUND_ROBIN);
    expect(updated.assignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
    expect(config.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(updated).not.toBe(config);
  });
});
