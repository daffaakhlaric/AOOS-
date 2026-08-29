import { describe, expect, it } from "vitest";

import { MetaAdsAgentEvents } from "../../../../src/domain/events/MetaAdsAgentEvents.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const correlationId = "corr-1";
const tenantId = "dss-motor";
const occurredAt = new Date("2026-08-09T00:00:00.000Z");

describe("MetaAdsAgentEvents", () => {
  it("publishes every one of the 8 spec-mandated events with the correct type + envelope", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsAgentEvents(publisher);

    await events.publishAgentCycleStarted({
      tenantId,
      agentId: "a1",
      adAccountId: "act_1",
      objectiveId: "o1",
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishAgentCycleCompleted({
      tenantId,
      agentId: "a1",
      executionPlanId: "p1",
      totalDecisions: 1,
      autoExecutedCount: 1,
      escalatedCount: 0,
      briefedToKaiCount: 0,
      noActionCount: 0,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishDecisionMade({
      tenantId,
      decisionId: "d1",
      targetId: "ad-1",
      targetType: "ad",
      actionKind: "PAUSE",
      decisionType: "AUTO_EXECUTE",
      confidence: 90,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishDecisionExecuted({
      tenantId,
      decisionId: "d1",
      targetId: "ad-1",
      targetType: "ad",
      actionKind: "PAUSE",
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishDecisionEscalated({
      tenantId,
      decisionId: "d2",
      escalationId: "e1",
      targetId: "realloc:1",
      reason: "large reallocation",
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishCreativeBriefGenerated({
      tenantId,
      creativeBriefId: "cb1",
      adId: "ad-1",
      angle: "DP_RINGAN",
      urgency: "HIGH",
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishDigestGenerated({
      tenantId,
      date: occurredAt,
      currentHotLeads: 12,
      targetHotLeads: 50,
      correlationId,
      occurredAt,
      version: "1.0",
    });
    await events.publishAgentError({
      tenantId,
      stage: "ANALYZE",
      code: "VALIDATION_ERROR",
      message: "bad account",
      correlationId,
      occurredAt,
      version: "1.0",
    });

    expect(publisher.published.map((p) => p.type)).toEqual([
      "aaos.samantha.cycle.started",
      "aaos.samantha.cycle.completed",
      "aaos.samantha.decision.made",
      "aaos.samantha.decision.executed",
      "aaos.samantha.decision.escalated",
      "aaos.samantha.creative.briefed",
      "aaos.samantha.digest.generated",
      "aaos.samantha.error",
    ]);
    expect(publisher.published.every((p) => p.producer === "@aos/meta-ads-agent")).toBe(true);
    expect(publisher.published.every((p) => p.version === "1.0.0")).toBe(true);
  });
});
