import { describe, expect, it } from "vitest";

import { ObjectiveEngineEvents } from "../../../../src/domain/events/ObjectiveEngineEvents.js";
import { OnTrackStatus } from "../../../../src/domain/value-objects/OnTrackStatus.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-08-09T00:00:00.000Z");

describe("ObjectiveEngineEvents", () => {
  it("publishObjectiveCreated publishes with correct type/category/tenantId/correlationId/payload", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishObjectiveCreated({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published.length).toBe(1);
    const call = publisher.published[0]!;
    expect(call.type).toBe("aaos.objective.created");
    expect(call.category).toBe("domain");
    expect(call.tenantId).toBe("dss-motor");
    expect(call.correlationId).toBe("corr-1");
    expect(call.source).toBe("@aos/objective-engine");
    expect(call.producer).toBe("@aos/objective-engine");
    expect(call.version).toBe("1.0.0");
    expect((call.payload as { objectiveId: string }).objectiveId).toBe("obj-1");
  });

  it("publishObjectiveUpdated publishes aaos.objective.updated", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishObjectiveUpdated({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      targetHotLeads: 80,
      budgetAllocation: 40_000_000,
      focusUnits: ["Brio"],
      areaPriorities: ["BINTARO"],
      correlationId: "corr-2",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.type).toBe("aaos.objective.updated");
  });

  it("publishObjectiveCompleted publishes aaos.objective.completed", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishObjectiveCompleted({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      finalHotLeads: 50,
      targetHotLeads: 50,
      correlationId: "corr-3",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.type).toBe("aaos.objective.completed");
  });

  it("publishProgressUpdated publishes aaos.objective.progress.updated", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishProgressUpdated({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      currentHotLeads: 12,
      progressPercentage: 24,
      onTrackStatus: OnTrackStatus.AT_RISK,
      correlationId: "corr-4",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.type).toBe("aaos.objective.progress.updated");
  });

  it("publishObjectiveOffTrack publishes aaos.objective.off-track", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishObjectiveOffTrack({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      ratio: 0.4,
      currentHotLeads: 2,
      targetHotLeads: 50,
      daysRemaining: 10,
      correlationId: "corr-5",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.type).toBe("aaos.objective.off-track");
  });

  it("publishRecommendationGenerated publishes aaos.objective.recommendation", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher);
    await events.publishRecommendationGenerated({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      actionCount: 3,
      confidence: 80,
      correlationId: "corr-6",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.type).toBe("aaos.objective.recommendation");
  });

  it("uses a custom source when supplied", async () => {
    const publisher = createFakePublisher();
    const events = new ObjectiveEngineEvents(publisher, "custom-source");
    await events.publishObjectiveCreated({
      objectiveId: "obj-1",
      tenantId: "dss-motor",
      period: { month: 8, year: 2026 },
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["CINERE"],
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]!.source).toBe("custom-source");
  });
});
