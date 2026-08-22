import { AssignmentMode, BranchId, SalesHumanId } from "@aos/branch-manager";
import { PhoneNumber, PhoneNumberId } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { Lead } from "../../../src/domain/entities/Lead.js";
import { LeadId } from "../../../src/domain/value-objects/LeadId.js";
import { LeadSource } from "../../../src/domain/value-objects/LeadSource.js";
import { LeadStatus } from "../../../src/domain/value-objects/LeadStatus.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const NOW = new Date("2026-01-15T09:00:00.000Z");
const LATER = new Date("2026-01-15T10:00:00.000Z");

function baseProps() {
  return {
    id: LeadId.generate(),
    tenantId: "dss-motor",
    leadSource: LeadSource.CTWA,
    leadPhone: unwrap(PhoneNumber.create("+6281200000099")),
    branchId: BranchId.BINTARO,
    wabaPhoneNumberId: unwrap(PhoneNumberId.create("waba-1")),
    status: LeadStatus.NEW,
    score: 0,
    temperature: LeadStatus.COLD as const,
    qualification: {
      budget: false,
      unit: false,
      area: false,
      payment: false,
      timeline: false,
      name: false,
    },
    broadcastCount: 0,
    recyclingArchived: false,
    syncedToMetaAudience: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("Lead entity", () => {
  it("creates a valid lead with score 0", () => {
    const lead = unwrap(Lead.create(baseProps()));
    expect(lead.score).toBe(0);
    expect(lead.status).toBe(LeadStatus.NEW);
    expect(lead.temperature).toBe(LeadStatus.COLD);
  });

  it("rejects a score below 0", () => {
    const error = unwrapErr(Lead.create({ ...baseProps(), score: -1 }));
    expect(error.message).toContain("score");
  });

  it("rejects a score above 100", () => {
    const error = unwrapErr(Lead.create({ ...baseProps(), score: 101 }));
    expect(error.message).toContain("score");
  });

  it("rejects an empty tenantId", () => {
    const error = unwrapErr(Lead.create({ ...baseProps(), tenantId: "" }));
    expect(error.message).toContain("tenantId");
  });

  it("withStatus returns a new Lead with the updated status/updatedAt", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const updated = lead.withStatus(LeadStatus.WARM, LATER);
    expect(updated.status).toBe(LeadStatus.WARM);
    expect(updated.updatedAt).toBe(LATER);
    expect(lead.status).toBe(LeadStatus.NEW); // original untouched
  });

  it("withScore updates status to the new temperature bucket when pre-assignment", () => {
    const lead = unwrap(Lead.create({ ...baseProps(), status: LeadStatus.COLD }));
    const updated = lead.withScore(70, LeadStatus.HOT, LATER, LATER);
    expect(updated.score).toBe(70);
    expect(updated.temperature).toBe(LeadStatus.HOT);
    expect(updated.status).toBe(LeadStatus.HOT);
    expect(updated.becameHotAt).toBe(LATER);
  });

  it("withScore does NOT change status when lead is ASSIGNED", () => {
    const lead = unwrap(Lead.create({ ...baseProps(), status: LeadStatus.ASSIGNED }));
    const updated = lead.withScore(70, LeadStatus.HOT, LATER);
    expect(updated.status).toBe(LeadStatus.ASSIGNED);
    expect(updated.temperature).toBe(LeadStatus.HOT);
  });

  it("withScore does NOT change status when lead is CLOSED", () => {
    const lead = unwrap(Lead.create({ ...baseProps(), status: LeadStatus.CLOSED }));
    const updated = lead.withScore(10, LeadStatus.COLD, LATER);
    expect(updated.status).toBe(LeadStatus.CLOSED);
  });

  it("withScore preserves becameHotAt when not passed", () => {
    const lead = unwrap(Lead.create({ ...baseProps(), becameHotAt: NOW }));
    const updated = lead.withScore(80, LeadStatus.HOT, LATER);
    expect(updated.becameHotAt).toBe(NOW);
  });

  it("withAssignment sets status=ASSIGNED and the assignment fields", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const salesHumanId = SalesHumanId.generate();
    const updated = lead.withAssignment(salesHumanId, AssignmentMode.SMART_ASSIGN, LATER);
    expect(updated.status).toBe(LeadStatus.ASSIGNED);
    expect(updated.assignedSalesId).toBe(salesHumanId);
    expect(updated.assignmentMode).toBe(AssignmentMode.SMART_ASSIGN);
    expect(updated.assignedAt).toBe(LATER);
  });

  it("withClosed sets status=CLOSED", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const updated = lead.withClosed(LATER);
    expect(updated.status).toBe(LeadStatus.CLOSED);
    expect(updated.updatedAt).toBe(LATER);
  });

  it("withLastMessageAt sets firstMessageAt on the first call only", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const first = lead.withLastMessageAt(NOW);
    expect(first.firstMessageAt).toBe(NOW);
    expect(first.lastMessageAt).toBe(NOW);

    const second = first.withLastMessageAt(LATER);
    expect(second.firstMessageAt).toBe(NOW); // unchanged
    expect(second.lastMessageAt).toBe(LATER);
  });

  it("defaults broadcastCount=0 and recyclingArchived=false", () => {
    const lead = unwrap(Lead.create(baseProps()));
    expect(lead.broadcastCount).toBe(0);
    expect(lead.recyclingArchived).toBe(false);
    expect(lead.lastBroadcastAt).toBeUndefined();
    expect(lead.lastBroadcastTemplateId).toBeUndefined();
  });

  it("withBroadcastSent increments broadcastCount and stamps lastBroadcastAt/lastBroadcastTemplateId", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const updated = lead.withBroadcastSent("template-1", LATER, LATER);
    expect(updated.broadcastCount).toBe(1);
    expect(updated.lastBroadcastAt).toBe(LATER);
    expect(updated.lastBroadcastTemplateId).toBe("template-1");
    expect(updated.updatedAt).toBe(LATER);
    expect(lead.broadcastCount).toBe(0); // original untouched

    const twice = updated.withBroadcastSent("template-2", LATER, LATER);
    expect(twice.broadcastCount).toBe(2);
    expect(twice.lastBroadcastTemplateId).toBe("template-2");
  });

  it("withRecyclingArchived sets recyclingArchived and updatedAt", () => {
    const lead = unwrap(Lead.create(baseProps()));
    const archived = lead.withRecyclingArchived(true, LATER);
    expect(archived.recyclingArchived).toBe(true);
    expect(archived.updatedAt).toBe(LATER);
    expect(lead.recyclingArchived).toBe(false); // original untouched

    const unarchived = archived.withRecyclingArchived(false, LATER);
    expect(unarchived.recyclingArchived).toBe(false);
  });

  it("withSyncedToMetaAudience sets syncedToMetaAudience, syncedAt, and updatedAt", () => {
    const lead = unwrap(Lead.create(baseProps()));
    expect(lead.syncedToMetaAudience).toBe(false);
    expect(lead.syncedAt).toBeUndefined();

    const synced = lead.withSyncedToMetaAudience(LATER);
    expect(synced.syncedToMetaAudience).toBe(true);
    expect(synced.syncedAt).toBe(LATER);
    expect(synced.updatedAt).toBe(LATER);
    expect(lead.syncedToMetaAudience).toBe(false); // original untouched
  });

  it("exposes every getter matching the constructed props", () => {
    const props = baseProps();
    const lead = unwrap(
      Lead.create({ ...props, campaignId: "#C047", adId: "#A001", leadName: "Budi" }),
    );
    expect(lead.id).toBe(props.id);
    expect(lead.leadSource).toBe(LeadSource.CTWA);
    expect(lead.campaignId).toBe("#C047");
    expect(lead.adId).toBe("#A001");
    expect(lead.leadName).toBe("Budi");
    expect(lead.branchId).toBe(BranchId.BINTARO);
    expect(lead.createdAt).toBe(NOW);
    expect(lead.updatedAt).toBe(NOW);
  });
});
