import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadMapper } from "../../../src/infrastructure/mappers/LeadMapper.js";
import { makeLeadRow } from "../../fixtures/leadStoreFixtures.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("LeadMapper.toDomain", () => {
  it("maps every field exactly, 1:1", () => {
    const salesHumanId = SalesHumanId.generate().toString();
    const row = makeLeadRow({
      tenant_id: "dss-motor",
      lead_source: "CTWA",
      campaign_id: "#C047",
      ad_id: "#A001",
      ad_account_id: "act_1",
      lead_phone: "+6281234567890",
      lead_name: "Budi",
      branch_id: BranchId.CINERE,
      waba_phone_number_id: "waba-cinere-1",
      status: "ASSIGNED",
      score: 72,
      temperature: "HOT",
      qual_budget: true,
      qual_unit: true,
      qual_area: false,
      qual_payment: true,
      qual_timeline: false,
      qual_name: true,
      assigned_sales_id: salesHumanId,
      assigned_at: "2026-01-15T09:00:00.000Z",
      assignment_mode: AssignmentMode.SMART_ASSIGN,
      first_message_at: "2026-01-14T08:00:00.000Z",
      last_message_at: "2026-01-15T08:30:00.000Z",
      became_hot_at: "2026-01-15T08:45:00.000Z",
      created_at: "2026-01-14T07:00:00.000Z",
      updated_at: "2026-01-15T09:00:00.000Z",
    });

    const lead = unwrap(LeadMapper.toDomain(row));

    expect(lead.id.toString()).toBe(row.id);
    expect(lead.tenantId).toBe("dss-motor");
    expect(lead.leadSource).toBe("CTWA");
    expect(lead.campaignId).toBe("#C047");
    expect(lead.adId).toBe("#A001");
    expect(lead.adAccountId).toBe("act_1");
    expect(lead.leadPhone.toString()).toBe("+6281234567890");
    expect(lead.leadName).toBe("Budi");
    expect(lead.branchId).toBe(BranchId.CINERE);
    expect(lead.wabaPhoneNumberId.toString()).toBe("waba-cinere-1");
    expect(lead.status).toBe("ASSIGNED");
    expect(lead.score).toBe(72);
    expect(lead.temperature).toBe("HOT");
    expect(lead.qualification).toEqual({
      budget: true,
      unit: true,
      area: false,
      payment: true,
      timeline: false,
      name: true,
    });
    expect(lead.assignedSalesId?.toString()).toBe(salesHumanId);
    expect(lead.assignedAt?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(lead.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(lead.firstMessageAt?.toISOString()).toBe("2026-01-14T08:00:00.000Z");
    expect(lead.lastMessageAt?.toISOString()).toBe("2026-01-15T08:30:00.000Z");
    expect(lead.becameHotAt?.toISOString()).toBe("2026-01-15T08:45:00.000Z");
    expect(lead.createdAt.toISOString()).toBe("2026-01-14T07:00:00.000Z");
    expect(lead.updatedAt.toISOString()).toBe("2026-01-15T09:00:00.000Z");
  });

  it("maps null optional columns to undefined", () => {
    const row = makeLeadRow({
      campaign_id: null,
      ad_id: null,
      ad_account_id: null,
      lead_name: null,
      assigned_sales_id: null,
      assigned_at: null,
      assignment_mode: null,
      first_message_at: null,
      last_message_at: null,
      became_hot_at: null,
    });
    const lead = unwrap(LeadMapper.toDomain(row));
    expect(lead.campaignId).toBeUndefined();
    expect(lead.adId).toBeUndefined();
    expect(lead.adAccountId).toBeUndefined();
    expect(lead.leadName).toBeUndefined();
    expect(lead.assignedSalesId).toBeUndefined();
    expect(lead.assignedAt).toBeUndefined();
    expect(lead.assignmentMode).toBeUndefined();
    expect(lead.firstMessageAt).toBeUndefined();
    expect(lead.lastMessageAt).toBeUndefined();
    expect(lead.becameHotAt).toBeUndefined();
  });

  it("fails on an invalid lead_phone", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ lead_phone: "0812" })));
    expect(error.message).toContain("PhoneNumber");
  });

  it("fails on an invalid lead_source", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ lead_source: "TIKTOK" })));
    expect(error.message).toContain("leadSource");
  });

  it("fails on an invalid status", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ status: "BOGUS" })));
    expect(error.message).toContain("status");
  });

  it("fails on an invalid temperature", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ temperature: "BOILING" })));
    expect(error.message).toContain("temperature");
  });

  it("fails when temperature is a non-temperature LeadStatus (e.g. NEW)", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ temperature: "NEW" })));
    expect(error.message).toContain("temperature");
  });

  it("fails on an invalid branch_id", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ branch_id: "SURABAYA" })));
    expect(error.message).toContain("branch_id");
  });

  it("fails on an invalid assigned_sales_id", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ assigned_sales_id: "" })));
    expect(error.message).toContain("SalesHumanId");
  });

  it("fails on an invalid assignment_mode", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ assignment_mode: "COIN_FLIP" })));
    expect(error.message).toContain("assignment_mode");
  });

  it("fails on an invalid id", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ id: "" })));
    expect(error.message).toContain("LeadId");
  });

  it("fails on an invalid waba_phone_number_id", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ waba_phone_number_id: "" })));
    expect(error.message).toContain("PhoneNumberId");
  });

  it("fails when score is out of [0, 100] range (Lead entity validation)", () => {
    const error = unwrapErr(LeadMapper.toDomain(makeLeadRow({ score: 999 })));
    expect(error.message).toContain("score");
  });
});

describe("LeadMapper.toRow", () => {
  it("maps every field exactly, 1:1 (round trip)", () => {
    const row = makeLeadRow({
      assigned_sales_id: SalesHumanId.generate().toString(),
      assignment_mode: AssignmentMode.MANUAL,
      status: "ASSIGNED",
    });
    const lead = unwrap(LeadMapper.toDomain(row));
    const roundTripped = LeadMapper.toRow(lead);
    expect(roundTripped).toEqual(row);
  });

  it("maps undefined optional fields to null", () => {
    const row = makeLeadRow({
      campaign_id: null,
      ad_id: null,
      ad_account_id: null,
      lead_name: null,
      assigned_sales_id: null,
      assigned_at: null,
      assignment_mode: null,
      first_message_at: null,
      last_message_at: null,
      became_hot_at: null,
    });
    const lead = unwrap(LeadMapper.toDomain(row));
    const mapped = LeadMapper.toRow(lead);
    expect(mapped.campaign_id).toBeNull();
    expect(mapped.ad_id).toBeNull();
    expect(mapped.ad_account_id).toBeNull();
    expect(mapped.lead_name).toBeNull();
    expect(mapped.assigned_sales_id).toBeNull();
    expect(mapped.assigned_at).toBeNull();
    expect(mapped.assignment_mode).toBeNull();
    expect(mapped.first_message_at).toBeNull();
    expect(mapped.last_message_at).toBeNull();
    expect(mapped.became_hot_at).toBeNull();
  });
});
