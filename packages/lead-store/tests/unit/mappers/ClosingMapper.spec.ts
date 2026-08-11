import { BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClosingMapper } from "../../../src/infrastructure/mappers/ClosingMapper.js";
import { makeClosingRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("ClosingMapper.toDomain", () => {
  it("maps every field exactly, 1:1 (pinned rph_spk example row)", () => {
    const salesHumanId = SalesHumanId.generate().toString();
    const row = makeClosingRow({
      sales_human_id: salesHumanId,
      branch_id: BranchId.BINTARO,
      closing_type: "SPK",
      unit_id: "unit-9",
      unit_model: "Xpander Cross AT 2019",
      unit_price: 280_000_000,
      campaign_id: "#C047",
      ad_id: "#A001",
      commission_idr: 2_000_000,
      commission_pct: 1.5,
      notes: "fast close",
      test_drive_at: null,
      spk_at: "2026-01-15T09:00:00.000Z",
      created_at: "2026-01-15T09:00:00.000Z",
    });

    const closing = unwrap(ClosingMapper.toDomain(row));

    expect(closing.id.toString()).toBe(row.id);
    expect(closing.leadId.toString()).toBe(row.lead_id);
    expect(closing.salesHumanId.toString()).toBe(salesHumanId);
    expect(closing.branchId).toBe(BranchId.BINTARO);
    expect(closing.closingType).toBe("SPK");
    expect(closing.unitId).toBe("unit-9");
    expect(closing.unitModel).toBe("Xpander Cross AT 2019");
    expect(closing.unitPrice).toBe(280_000_000);
    expect(closing.campaignId).toBe("#C047");
    expect(closing.adId).toBe("#A001");
    expect(closing.commissionIdr).toBe(2_000_000);
    expect(closing.commissionPct).toBe(1.5);
    expect(closing.notes).toBe("fast close");
    expect(closing.testDriveAt).toBeUndefined();
    expect(closing.spkAt?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(closing.createdAt.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("maps null optional columns to undefined", () => {
    const closing = unwrap(
      ClosingMapper.toDomain(
        makeClosingRow({
          unit_id: null,
          unit_model: null,
          unit_price: null,
          campaign_id: null,
          ad_id: null,
          commission_idr: null,
          commission_pct: null,
          notes: null,
          test_drive_at: null,
          spk_at: null,
        }),
      ),
    );
    expect(closing.unitId).toBeUndefined();
    expect(closing.unitModel).toBeUndefined();
    expect(closing.unitPrice).toBeUndefined();
    expect(closing.campaignId).toBeUndefined();
    expect(closing.adId).toBeUndefined();
    expect(closing.commissionIdr).toBeUndefined();
    expect(closing.commissionPct).toBeUndefined();
    expect(closing.notes).toBeUndefined();
    expect(closing.testDriveAt).toBeUndefined();
    expect(closing.spkAt).toBeUndefined();
  });

  it("fails on an invalid id", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ id: "" })));
    expect(error.message).toContain("ClosingId");
  });

  it("fails on an invalid lead_id", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ lead_id: "" })));
    expect(error.message).toContain("LeadId");
  });

  it("fails on an invalid sales_human_id", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ sales_human_id: "" })));
    expect(error.message).toContain("SalesHumanId");
  });

  it("fails on an invalid branch_id", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ branch_id: "JAKARTA" })));
    expect(error.message).toContain("branch_id");
  });

  it("fails on an invalid closing_type", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ closing_type: "REFUND" })));
    expect(error.message).toContain("REFUND");
  });

  it("fails when unit_price is negative (Closing entity validation)", () => {
    const error = unwrapErr(ClosingMapper.toDomain(makeClosingRow({ unit_price: -1 })));
    expect(error.message).toContain("unitPrice");
  });
});

describe("ClosingMapper.toRow", () => {
  it("round-trips every field exactly", () => {
    const row = makeClosingRow({ notes: "note" });
    const closing = unwrap(ClosingMapper.toDomain(row));
    expect(ClosingMapper.toRow(closing)).toEqual(row);
  });

  it("maps undefined optional fields to null", () => {
    const row = makeClosingRow({
      unit_id: null,
      unit_model: null,
      unit_price: null,
      campaign_id: null,
      ad_id: null,
      commission_idr: null,
      commission_pct: null,
      notes: null,
      test_drive_at: null,
      spk_at: null,
    });
    const closing = unwrap(ClosingMapper.toDomain(row));
    const mapped = ClosingMapper.toRow(closing);
    expect(mapped.unit_id).toBeNull();
    expect(mapped.campaign_id).toBeNull();
    expect(mapped.commission_idr).toBeNull();
    expect(mapped.notes).toBeNull();
  });
});
