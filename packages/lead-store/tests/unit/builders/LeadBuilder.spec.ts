import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadBuilder } from "../../../src/builders/LeadBuilder.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { LeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { LeadStatus } from "../../../src/domain/value-objects/LeadStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("LeadBuilder", () => {
  it("builds a lead with sensible defaults", () => {
    const lead = unwrap(new LeadBuilder().build());
    expect(lead.status).toBe(LeadStatus.NEW);
    expect(lead.score).toBe(0);
    expect(lead.branchId).toBe(BranchId.BINTARO);
  });

  it("applies every with* override", () => {
    const id = LeadId.generate();
    const salesHumanId = SalesHumanId.generate();
    const now = new Date("2026-01-15T09:00:00.000Z");
    const lead = unwrap(
      new LeadBuilder()
        .withId(id)
        .withTenantId("tenant-x")
        .withLeadSource(LeadSource.FORM)
        .withCampaignId("#C099")
        .withAdId("#A099")
        .withAdAccountId("act_9")
        .withLeadPhone("+6281299999999")
        .withLeadName("Siti")
        .withBranchId(BranchId.CINERE)
        .withWabaPhoneNumberId("waba-cinere-9")
        .withStatus(LeadStatus.WARM)
        .withScore(50)
        .withTemperature(LeadStatus.WARM)
        .withQualification({
          budget: true,
          unit: false,
          area: false,
          payment: false,
          timeline: false,
          name: false,
        })
        .withAssignedSalesId(salesHumanId)
        .withAssignedAt(now)
        .withAssignmentMode(AssignmentMode.MANUAL)
        .withFirstMessageAt(now)
        .withLastMessageAt(now)
        .withBecameHotAt(now)
        .withBroadcastCount(2)
        .withLastBroadcastAt(now)
        .withLastBroadcastTemplateId("template-1")
        .withRecyclingArchived(true)
        .withCreatedAt(now)
        .withUpdatedAt(now)
        .build(),
    );
    expect(lead.id).toBe(id);
    expect(lead.tenantId).toBe("tenant-x");
    expect(lead.leadSource).toBe(LeadSource.FORM);
    expect(lead.campaignId).toBe("#C099");
    expect(lead.adId).toBe("#A099");
    expect(lead.adAccountId).toBe("act_9");
    expect(lead.leadPhone.toString()).toBe("+6281299999999");
    expect(lead.leadName).toBe("Siti");
    expect(lead.branchId).toBe(BranchId.CINERE);
    expect(lead.wabaPhoneNumberId.toString()).toBe("waba-cinere-9");
    expect(lead.status).toBe(LeadStatus.WARM);
    expect(lead.score).toBe(50);
    expect(lead.temperature).toBe(LeadStatus.WARM);
    expect(lead.qualification.budget).toBe(true);
    expect(lead.assignedSalesId).toBe(salesHumanId);
    expect(lead.assignedAt).toBe(now);
    expect(lead.assignmentMode).toBe(AssignmentMode.MANUAL);
    expect(lead.firstMessageAt).toBe(now);
    expect(lead.lastMessageAt).toBe(now);
    expect(lead.becameHotAt).toBe(now);
    expect(lead.broadcastCount).toBe(2);
    expect(lead.lastBroadcastAt).toBe(now);
    expect(lead.lastBroadcastTemplateId).toBe("template-1");
    expect(lead.recyclingArchived).toBe(true);
    expect(lead.createdAt).toBe(now);
    expect(lead.updatedAt).toBe(now);
  });

  it("fails when leadPhone is invalid", () => {
    const error = unwrapErr(new LeadBuilder().withLeadPhone("0812").build());
    expect(error.message).toContain("PhoneNumber");
  });

  it("fails when wabaPhoneNumberId is empty", () => {
    const error = unwrapErr(new LeadBuilder().withWabaPhoneNumberId("").build());
    expect(error.message).toContain("PhoneNumberId");
  });

  it("fails when score is out of range", () => {
    const error = unwrapErr(new LeadBuilder().withScore(200).build());
    expect(error.message).toContain("score");
  });
});
