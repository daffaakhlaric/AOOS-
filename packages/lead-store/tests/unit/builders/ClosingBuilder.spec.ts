import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClosingBuilder } from "../../../src/builders/ClosingBuilder.js";
import { ClosingId } from "../../../src/domain/value-objects/ClosingId.js";
import { ClosingType } from "../../../src/domain/value-objects/ClosingType.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ClosingBuilder", () => {
  it("builds a closing with sensible defaults", () => {
    const closing = unwrap(new ClosingBuilder().build());
    expect(closing.closingType).toBe(ClosingType.SPK);
    expect(closing.branchId).toBe(BranchId.BINTARO);
  });

  it("applies every with* override", () => {
    const id = ClosingId.generate();
    const leadId = LeadId.generate();
    const salesHumanId = SalesHumanId.generate();
    const now = new Date("2026-01-15T09:00:00.000Z");
    const closing = unwrap(
      new ClosingBuilder()
        .withId(id)
        .withLeadId(leadId)
        .withSalesHumanId(salesHumanId)
        .withBranchId(BranchId.BANDUNG)
        .withClosingType(ClosingType.TEST_DRIVE)
        .withUnitId("unit-5")
        .withUnitModel("Pajero Sport")
        .withUnitPrice(500_000_000)
        .withCampaignId("#C001")
        .withAdId("#A001")
        .withCommissionIdr(3_000_000)
        .withCommissionPct(2.0)
        .withNotes("great customer")
        .withTestDriveAt(now)
        .withSpkAt(now)
        .withCreatedAt(now)
        .build(),
    );
    expect(closing.id).toBe(id);
    expect(closing.leadId).toBe(leadId);
    expect(closing.salesHumanId).toBe(salesHumanId);
    expect(closing.branchId).toBe(BranchId.BANDUNG);
    expect(closing.closingType).toBe(ClosingType.TEST_DRIVE);
    expect(closing.unitId).toBe("unit-5");
    expect(closing.unitModel).toBe("Pajero Sport");
    expect(closing.unitPrice).toBe(500_000_000);
    expect(closing.campaignId).toBe("#C001");
    expect(closing.adId).toBe("#A001");
    expect(closing.commissionIdr).toBe(3_000_000);
    expect(closing.commissionPct).toBe(2.0);
    expect(closing.notes).toBe("great customer");
    expect(closing.testDriveAt).toBe(now);
    expect(closing.spkAt).toBe(now);
    expect(closing.createdAt).toBe(now);
  });

  it("fails when unitPrice is negative", () => {
    const error = unwrapErr(new ClosingBuilder().withUnitPrice(-1).build());
    expect(error.message).toContain("unitPrice");
  });
});
