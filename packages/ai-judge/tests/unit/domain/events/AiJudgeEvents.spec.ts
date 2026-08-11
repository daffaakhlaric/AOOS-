import { describe, expect, it } from "vitest";

import { ObservablePublisher } from "../../../../src/application/services/ObservablePublisher.js";
import { AiJudgeEvents } from "../../../../src/domain/events/AiJudgeEvents.js";

describe("AiJudgeEvents", () => {
  it("publishJudgementCompleted() publishes to the correct topic with the payload intact", async () => {
    const publisher = new ObservablePublisher();
    const events = new AiJudgeEvents(publisher);
    await events.publishJudgementCompleted({
      judgementId: "j1",
      sessionId: "s1",
      personaId: "ready_buyer",
      overallScore: 85.5,
      grade: "B+",
      verdict: "APPROVE",
      isGoldenCandidate: true,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: new Date(2026, 0, 1),
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.judge.judgement.completed");
    expect(publisher.published[0]?.tenantId).toBe("t1");
  });

  it("publishGoldenConversationSaved() publishes to the correct topic", async () => {
    const publisher = new ObservablePublisher();
    const events = new AiJudgeEvents(publisher);
    await events.publishGoldenConversationSaved({
      goldenConversationId: "g1",
      sessionId: "s1",
      personaId: "ready_buyer",
      overallScore: 90,
      tags: ["ready_buyer"],
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: new Date(2026, 0, 1),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.judge.golden-conversation.saved");
  });

  it("publishVersionCompared() publishes to the correct topic", async () => {
    const publisher = new ObservablePublisher();
    const events = new AiJudgeEvents(publisher);
    await events.publishVersionCompared({
      personaId: "ready_buyer",
      beforeJudgementId: "j1",
      afterJudgementId: "j2",
      overallScoreDelta: 5,
      verdictImproved: true,
      verdictRegressed: false,
      tenantId: "t1",
      correlationId: "c1",
      occurredAt: new Date(2026, 0, 1),
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.judge.version.compared");
  });
});
