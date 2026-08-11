import { describe, expect, it } from "vitest";

import { parseBranchManagerConfig } from "../../../src/config/BranchManagerConfig.js";
import { AssignmentMode } from "../../../src/domain/value-objects/AssignmentMode.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

function validInput() {
  return {
    tenantId: "tenant-dss-motor",
    phoneNumberIdBintaro: "PHONE_NUMBER_ID_BINTARO",
    phoneNumberIdCinere: "PHONE_NUMBER_ID_CINERE",
    phoneNumberIdPondokBambu: "PHONE_NUMBER_ID_PONDOK_BAMBU",
    phoneNumberIdBandung: "PHONE_NUMBER_ID_BANDUNG",
    phoneNumberBintaro: "+628110000001",
    phoneNumberCinere: "+628110000002",
    phoneNumberPondokBambu: "+628110000003",
    phoneNumberBandung: "+628110000004",
  };
}

describe("parseBranchManagerConfig", () => {
  it("parses valid input and applies documented defaults", () => {
    const config = unwrap(parseBranchManagerConfig(validInput()));
    expect(config.tenantId).toBe("tenant-dss-motor");
    expect(config.defaultMaxLeadsPerSalesPerDay).toBe(10);
    expect(config.defaultAssignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(config.maxQueueSize).toBe(100);
    expect(config.queueTtlMs).toBe(86_400_000);
  });

  it("accepts explicit overrides for every default", () => {
    const config = unwrap(
      parseBranchManagerConfig({
        ...validInput(),
        defaultMaxLeadsPerSalesPerDay: 20,
        defaultAssignmentMode: "ROUND_ROBIN",
        maxQueueSize: 50,
        queueTtlMs: 3_600_000,
      }),
    );
    expect(config.defaultMaxLeadsPerSalesPerDay).toBe(20);
    expect(config.defaultAssignmentMode).toBe(AssignmentMode.ROUND_ROBIN);
    expect(config.maxQueueSize).toBe(50);
    expect(config.queueTtlMs).toBe(3_600_000);
  });

  it("rejects a missing tenantId", () => {
    const { tenantId: _tenantId, ...rest } = validInput();
    const error = unwrapErr(parseBranchManagerConfig(rest));
    expect(error.message).toContain("BranchManagerConfig validation failed");
  });

  it("rejects a missing phone number id field", () => {
    const { phoneNumberIdBintaro: _id, ...rest } = validInput();
    const error = unwrapErr(parseBranchManagerConfig(rest));
    expect(error.message).toContain("phoneNumberIdBintaro");
  });

  it("rejects an out-of-range defaultMaxLeadsPerSalesPerDay", () => {
    const error = unwrapErr(
      parseBranchManagerConfig({ ...validInput(), defaultMaxLeadsPerSalesPerDay: 0 }),
    );
    expect(error.message).toContain("BranchManagerConfig validation failed");
  });

  it("rejects a completely non-object input", () => {
    const error = unwrapErr(parseBranchManagerConfig(null));
    expect(error.message).toContain("BranchManagerConfig validation failed");
  });
});
