import { AssignmentMode } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { LeadStoreEvents } from "../../../src/domain/events/LeadStoreEvents.js";
import { createFakePublisher } from "../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-01-15T09:00:00.000Z");

describe("LeadStoreEvents", () => {
  it("publishLeadCreated wires the correct type/producer", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishLeadCreated({
      leadId: "lead-1",
      leadPhone: "+6281200000099",
      branchId: "BINTARO",
      leadSource: "CTWA",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]).toMatchObject({
      type: "aaos.lead-store.lead.created",
      source: "@aos/lead-store",
      producer: "@aos/lead-store",
      version: "1.0.0",
    });
  });

  it("publishLeadStatusChanged wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishLeadStatusChanged({
      leadId: "lead-1",
      branchId: "BINTARO",
      fromStatus: "NEW" as never,
      toStatus: "COLD" as never,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.lead.status-changed");
  });

  it("publishLeadAssigned wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishLeadAssigned({
      assignmentId: "a1",
      leadId: "lead-1",
      branchId: "BINTARO",
      salesHumanId: "s1",
      assignmentMode: AssignmentMode.SMART_ASSIGN,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.lead.assigned");
  });

  it("publishLeadBecameHot wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishLeadBecameHot({
      leadId: "lead-1",
      branchId: "BINTARO",
      score: 70,
      becameHotAt: OCCURRED_AT,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.lead.became-hot");
  });

  it("publishConversationUpdated wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishConversationUpdated({
      conversationId: "conv-1",
      leadId: "lead-1",
      direction: "INCOMING",
      messageCount: 1,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.conversation.updated");
  });

  it("publishClosingRecorded wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishClosingRecorded({
      closingId: "closing-1",
      leadId: "lead-1",
      branchId: "BINTARO",
      closingType: "SPK",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.closing.recorded");
  });

  it("publishScoreUpdated wires the correct type", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishScoreUpdated({
      leadId: "lead-1",
      scoreBefore: 0,
      scoreAfter: 25,
      delta: 25,
      reason: "BUDGET",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.lead-store.lead.score-updated");
  });

  it("defaults source to @aos/lead-store when not overridden", async () => {
    const publisher = createFakePublisher();
    const events = new LeadStoreEvents(publisher);
    await events.publishScoreUpdated({
      leadId: "lead-1",
      scoreBefore: 0,
      scoreAfter: 25,
      delta: 25,
      reason: "BUDGET",
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("@aos/lead-store");
  });
});
