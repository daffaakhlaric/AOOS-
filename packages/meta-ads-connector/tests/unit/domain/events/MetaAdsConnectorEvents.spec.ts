import { EventBroker } from "@aos/event-bus";
import { describe, expect, it } from "vitest";

import { MetaAdsConnectorEvents } from "../../../../src/domain/events/MetaAdsConnectorEvents.js";
import { LeadType } from "../../../../src/domain/value-objects/LeadType.js";
import { PublisherPlatform } from "../../../../src/domain/value-objects/PublisherPlatform.js";
import { createFakePublisher } from "../../../helpers/publisher.js";

const base = {
  tenantId: "dss-motor",
  correlationId: "corr-1",
  occurredAt: new Date("2026-01-01T00:00:00.000Z"),
  version: "1.0" as const,
};

describe("MetaAdsConnectorEvents (fake publisher — shape assertions)", () => {
  it("publishSyncCompleted publishes on 'aaos.meta.sync.completed' with DOMAIN category", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishSyncCompleted({
      adAccountId: "act_1",
      campaignCount: 1,
      adSetCount: 2,
      adCount: 3,
      ...base,
    });
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]?.type).toBe("aaos.meta.sync.completed");
    expect(publisher.published[0]?.tenantId).toBe("dss-motor");
    expect(publisher.published[0]?.correlationId).toBe("corr-1");
    expect(publisher.published[0]?.producer).toBe("@aos/meta-ads-connector");
  });

  it("publishSyncFailed publishes on 'aaos.meta.sync.failed'", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishSyncFailed({
      adAccountId: "act_1",
      reason: "boom",
      errorCode: "UNAVAILABLE",
      ...base,
    });
    expect(publisher.published[0]?.type).toBe("aaos.meta.sync.failed");
  });

  it("publishLeadReceived publishes on 'aaos.meta.lead.received'", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishLeadReceived({
      leadId: "lead-1",
      adId: "ad-1",
      adSetId: "adset-1",
      campaignId: "campaign-1",
      adAccountId: "act_1",
      type: LeadType.CTWA,
      source: PublisherPlatform.FACEBOOK,
      ...base,
    });
    expect(publisher.published[0]?.type).toBe("aaos.meta.lead.received");
  });

  it("publishAdPaused publishes on 'aaos.meta.ad.paused'", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishAdPaused({ adId: "ad-1", ...base });
    expect(publisher.published[0]?.type).toBe("aaos.meta.ad.paused");
  });

  it("publishBudgetScaled publishes on 'aaos.meta.budget.scaled'", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishBudgetScaled({
      adSetId: "adset-1",
      previousBudget: 100,
      newBudget: 120,
      ...base,
    });
    expect(publisher.published[0]?.type).toBe("aaos.meta.budget.scaled");
  });

  it("publishObjectiveFixed publishes on 'aaos.meta.objective.fixed'", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishObjectiveFixed({
      campaignId: "campaign-1",
      previousObjective: "VISIT_INSTAGRAM_PROFILE",
      newObjective: "OUTCOME_ENGAGEMENT",
      ...base,
    });
    expect(publisher.published[0]?.type).toBe("aaos.meta.objective.fixed");
  });

  it("publishNewCampaignCreated publishes on 'aaos.meta.campaign.created' (AAOS-W1D-S3)", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher);
    await events.publishNewCampaignCreated({
      campaignId: "campaign-1",
      adSetId: "adset-1",
      adAccountId: "act_1",
      name: "Meta-CTWA-Leads-Mobix-Cinere",
      branch: "CINERE",
      funnel: "CTWA",
      ...base,
    });
    expect(publisher.published[0]?.type).toBe("aaos.meta.campaign.created");
  });

  it("uses a custom source string when provided", async () => {
    const publisher = createFakePublisher();
    const events = new MetaAdsConnectorEvents(publisher, "custom-source");
    await events.publishAdPaused({ adId: "ad-1", ...base });
    expect(publisher.published[0]?.source).toBe("custom-source");
  });
});

describe("MetaAdsConnectorEvents (real @aos/event-bus EventBroker — genuine integration)", () => {
  it("successfully publishes and dispatches through the real EventBroker without a validation error", async () => {
    // Regression test for a real bug found while writing this suite: the envelope `version` field
    // passed to `IPublisher.publish()` must be full SemVer ("1.0.0"), not the payload's own
    // spec-mandated "1.0" business version — passing "1.0" as the envelope version throws
    // `ValidationException` inside the real `EventBroker`/`EventPublisher`.
    const broker = new EventBroker();
    const events = new MetaAdsConnectorEvents(broker);
    await expect(events.publishAdPaused({ adId: "ad-1", ...base })).resolves.toBeUndefined();
  });

  it("the dispatched event's payload round-trips through the real broker unchanged", async () => {
    const broker = new EventBroker();
    let received: unknown;
    broker.subscribe({
      criteria: { pattern: "aaos.meta.ad.paused" },
      handler: (event) => {
        received = event.payload;
      },
    });
    const events = new MetaAdsConnectorEvents(broker);
    await events.publishAdPaused({ adId: "ad-42", ...base });
    expect((received as { adId: string }).adId).toBe("ad-42");
  });
});
