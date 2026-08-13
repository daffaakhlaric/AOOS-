import { EventCategory } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { ClosingTrackerEvents } from "../../../src/domain/events/ClosingTrackerEvents.js";
import { createFakePublisher } from "../../helpers/publisher.js";

const OCCURRED_AT = new Date("2026-08-15T09:00:00.000Z");

describe("ClosingTrackerEvents", () => {
  it("publishes ClosingReportGenerated with the correct type/category/source", async () => {
    const publisher = createFakePublisher();
    const events = new ClosingTrackerEvents(publisher);
    await events.publishClosingReportGenerated({
      reportId: "report-001",
      periodLabel: "2026-08",
      totalSpk: 4,
      totalTestDrives: 10,
      closingRate: 0.2,
      totalCommissionIdr: 3_000_000,
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.closing-tracker.report.generated");
    expect(publisher.published[0]?.category).toBe(EventCategory.DOMAIN);
    expect(publisher.published[0]?.source).toBe("@aos/closing-tracker");
    expect(publisher.published[0]?.tenantId).toBe("dss-motor");
    expect(publisher.published[0]?.correlationId).toBe("corr-1");
  });

  it("publishes MilestoneReached", async () => {
    const publisher = createFakePublisher();
    const events = new ClosingTrackerEvents(publisher);
    await events.publishMilestoneReached({
      milestoneType: "10_SPK",
      thresholdValue: 10,
      actualValue: 10,
      periodLabel: "2026-08",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.closing-tracker.milestone.reached");
  });

  it("publishes CampaignAttributed", async () => {
    const publisher = createFakePublisher();
    const events = new ClosingTrackerEvents(publisher);
    await events.publishCampaignAttributed({
      campaignId: "#C047",
      branch: "CINERE",
      method: "DIRECT",
      confidence: 100,
      rphSpk: 1_200_000,
      verdict: "SCALE",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.closing-tracker.campaign.attributed");
  });

  it("publishes ObjectiveCompleted", async () => {
    const publisher = createFakePublisher();
    const events = new ClosingTrackerEvents(publisher);
    await events.publishObjectiveCompleted({
      targetSpk: 50,
      achievedSpk: 50,
      periodLabel: "2026-08",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.type).toBe("aaos.closing-tracker.objective.completed");
  });

  it("uses a custom source when provided", async () => {
    const publisher = createFakePublisher();
    const events = new ClosingTrackerEvents(publisher, "custom-source");
    await events.publishObjectiveCompleted({
      targetSpk: 1,
      achievedSpk: 1,
      periodLabel: "2026-08",
      tenantId: "dss-motor",
      correlationId: "corr-1",
      occurredAt: OCCURRED_AT,
      version: "1.0",
    });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});
