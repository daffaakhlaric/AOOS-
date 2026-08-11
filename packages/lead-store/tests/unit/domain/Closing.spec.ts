import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { Closing } from "../../../src/domain/entities/Closing.js";
import { ClosingId } from "../../../src/domain/value-objects/ClosingId.js";
import { ClosingType } from "../../../src/domain/value-objects/ClosingType.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");

function baseProps() {
  return {
    id: ClosingId.generate(),
    leadId: LeadId.generate(),
    salesHumanId: SalesHumanId.generate(),
    branchId: BranchId.BINTARO,
    closingType: ClosingType.SPK,
    createdAt: NOW,
  };
}

describe("Closing entity", () => {
  it("creates a valid closing", () => {
    const closing = unwrap(Closing.create(baseProps()));
    expect(closing.closingType).toBe(ClosingType.SPK);
  });

  it("rejects a negative unitPrice", () => {
    const error = unwrapErr(Closing.create({ ...baseProps(), unitPrice: -1 }));
    expect(error.message).toContain("unitPrice");
  });

  it("rejects a negative commissionIdr", () => {
    const error = unwrapErr(Closing.create({ ...baseProps(), commissionIdr: -1 }));
    expect(error.message).toContain("commissionIdr");
  });

  it("accepts unitPrice/commissionIdr of exactly 0", () => {
    const closing = unwrap(Closing.create({ ...baseProps(), unitPrice: 0, commissionIdr: 0 }));
    expect(closing.unitPrice).toBe(0);
    expect(closing.commissionIdr).toBe(0);
  });

  it("exposes every getter matching the constructed props", () => {
    const props = baseProps();
    const closing = unwrap(
      Closing.create({
        ...props,
        unitId: "unit-1",
        unitModel: "Xpander Cross AT 2019",
        unitPrice: 280_000_000,
        campaignId: "#C047",
        adId: "#A001",
        commissionIdr: 2_000_000,
        commissionPct: 1.5,
        notes: "closed fast",
        testDriveAt: NOW,
        spkAt: NOW,
      }),
    );
    expect(closing.id).toBe(props.id);
    expect(closing.leadId).toBe(props.leadId);
    expect(closing.salesHumanId).toBe(props.salesHumanId);
    expect(closing.branchId).toBe(BranchId.BINTARO);
    expect(closing.unitId).toBe("unit-1");
    expect(closing.unitModel).toBe("Xpander Cross AT 2019");
    expect(closing.unitPrice).toBe(280_000_000);
    expect(closing.campaignId).toBe("#C047");
    expect(closing.adId).toBe("#A001");
    expect(closing.commissionIdr).toBe(2_000_000);
    expect(closing.commissionPct).toBe(1.5);
    expect(closing.notes).toBe("closed fast");
    expect(closing.testDriveAt).toBe(NOW);
    expect(closing.spkAt).toBe(NOW);
    expect(closing.createdAt).toBe(NOW);
  });
});
