import { BranchId } from "@aos/branch-manager";
import { describe, expect, it } from "vitest";

import { ClaraAgentEvents } from "../../../../src/domain/events/ClaraAgentEvents.js";
import { LeadTemperature } from "../../../../src/domain/value-objects/LeadTemperature.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-08-10T09:00:00.000Z");
const BASE = {
  tenantId: "tenant-dss-motor",
  correlationId: "corr-1",
  occurredAt: OCCURRED_AT,
  version: "1.0" as const,
};

describe("ClaraAgentEvents", () => {
  it("publishConversationStarted() publishes aaos.sales.conversation.started", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishConversationStarted({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.conversation.started");
  });

  it("publishMessageProcessed() publishes aaos.sales.message.processed", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishMessageProcessed({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      stage: "GREETING" as never,
      score: 0,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.message.processed");
  });

  it("publishLeadScoreUpdated() publishes aaos.sales.lead.score-updated", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishLeadScoreUpdated({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      criterion: "BUDGET",
      delta: 25,
      previousScore: 0,
      newScore: 25,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.lead.score-updated");
  });

  it("publishLeadBecameHot() publishes aaos.sales.lead.became-hot", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishLeadBecameHot({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      score: 65,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.lead.became-hot");
  });

  it("publishHandoffTriggered() publishes aaos.sales.handoff.triggered", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishHandoffTriggered({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      score: 65,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.handoff.triggered");
  });

  it("publishFollowUpScheduled() publishes aaos.sales.follow-up.scheduled", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishFollowUpScheduled({
      leadPhone: "+6281200000001",
      branchId: BranchId.CINERE,
      temperature: LeadTemperature.COLD,
      days: [3, 7, 14],
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.follow-up.scheduled");
  });

  it("publishConversationClosed() publishes aaos.sales.conversation.closed", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishConversationClosed({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      reason: "no reply",
      finalScore: 10,
      ...BASE,
    });
    expect(publisher.published[0]?.type).toBe("aaos.sales.conversation.closed");
  });

  it("uses the default source '@aos/sales-agent' when not overridden", async () => {
    const publisher = createFakePublisher();
    const events = new ClaraAgentEvents(publisher);
    await events.publishConversationClosed({
      conversationId: "c1",
      leadPhone: "+6281200000001",
      reason: "x",
      finalScore: 0,
      ...BASE,
    });
    expect(publisher.published[0]?.source).toBe("@aos/sales-agent");
  });
});
