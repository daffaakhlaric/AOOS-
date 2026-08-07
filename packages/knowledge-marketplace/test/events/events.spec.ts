import { describe, expect, it } from "vitest";

import { KnowledgeMarketplaceEventType } from "../../src/events/knowledge-marketplace-event-type.js";
import { KnowledgeMarketplaceEvents } from "../../src/events/knowledge-marketplace-events.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { fakePublisher } from "../helpers/event-publisher-fixture.js";

describe("KnowledgeMarketplaceEventType", () => {
  it("has exactly 11 events", () => {
    expect(Object.values(KnowledgeMarketplaceEventType)).toHaveLength(11);
  });

  it("MarketplaceCreated is knowledge.marketplace.created", () => {
    expect(KnowledgeMarketplaceEventType.MARKETPLACE_CREATED).toBe("knowledge.marketplace.created");
  });

  it("ListingCreated is knowledge.marketplace.listing.created", () => {
    expect(KnowledgeMarketplaceEventType.LISTING_CREATED).toBe(
      "knowledge.marketplace.listing.created",
    );
  });

  it("ListingRemoved is knowledge.marketplace.listing.removed", () => {
    expect(KnowledgeMarketplaceEventType.LISTING_REMOVED).toBe(
      "knowledge.marketplace.listing.removed",
    );
  });
});

describe("KnowledgeMarketplaceEvents", () => {
  it("publishes with the correct producer and payload shape", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeMarketplaceEvents(publisher);
    const context = contextFixture();

    await events.publishMarketplaceEvent(KnowledgeMarketplaceEventType.LISTING_CREATED, context);

    expect(publish).toHaveBeenCalledTimes(1);
    const call = publish.mock.calls[0]?.[0];
    expect(call.producer).toBe("@aos/knowledge-marketplace");
    expect(call.type).toBe(KnowledgeMarketplaceEventType.LISTING_CREATED);
    expect(call.payload.token).toBe(context.token);
    expect(call.payload.listingId).toBe(context.listingId);
    expect(call.tenantId).toBe(context.tenantId);
  });

  it("merges extra payload fields", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeMarketplaceEvents(publisher);
    const context = contextFixture();

    await events.publishMarketplaceEvent(KnowledgeMarketplaceEventType.LISTING_REVIEWED, context, {
      approved: true,
    });

    const call = publish.mock.calls[0]?.[0];
    expect(call.payload.approved).toBe(true);
  });

  it("uses a custom source when supplied", async () => {
    const { publisher, publish } = fakePublisher();
    const events = new KnowledgeMarketplaceEvents(publisher, "custom-source");
    await events.publishMarketplaceEvent(
      KnowledgeMarketplaceEventType.MARKETPLACE_CREATED,
      contextFixture(),
    );
    expect(publish.mock.calls[0]?.[0].source).toBe("custom-source");
  });
});
