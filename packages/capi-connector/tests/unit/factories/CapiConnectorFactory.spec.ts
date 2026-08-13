import { createMockLogger } from "@aos/testing";
import { describe, expect, it } from "vitest";

import { CapiConnectorFactory } from "../../../src/factories/CapiConnectorFactory.js";
import { createFakeCapiClient } from "../../helpers/capi-client.js";
import { buildConfig } from "../../helpers/config.js";
import { createFakeClosingRepository, createGetLead } from "../../helpers/lead-store-fakes.js";
import { createFakePublisher } from "../../helpers/publisher.js";
import { createFakeSubscriptionManager } from "../../helpers/subscription-manager.js";

describe("CapiConnectorFactory", () => {
  it("wires every use case and service", () => {
    const connector = CapiConnectorFactory.create({
      config: buildConfig(),
      publisher: createFakePublisher(),
      subscriptionManager: createFakeSubscriptionManager(),
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
      capiClient: createFakeCapiClient(),
      logger: createMockLogger() as never,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(connector.sendContactEvent).toBeDefined();
    expect(connector.sendInitiateCheckoutEvent).toBeDefined();
    expect(connector.sendAddToWishlistEvent).toBeDefined();
    expect(connector.sendLeadEvent).toBeDefined();
    expect(connector.sendPurchaseEvent).toBeDefined();
    expect(connector.sendBatch).toBeDefined();
    expect(connector.getEmqScore).toBeDefined();
    expect(connector.capiEventService).toBeDefined();
    expect(connector.eventListenerService).toBeDefined();
  });

  it("defaults logger/now/capiClient when not provided", () => {
    const connector = CapiConnectorFactory.create({
      config: buildConfig(),
      publisher: createFakePublisher(),
      subscriptionManager: createFakeSubscriptionManager(),
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
    });
    expect(connector.capiEventService).toBeDefined();
  });

  it("EventListenerService.start() subscribes to all 4 topics using the wired components", () => {
    const subscriptionManager = createFakeSubscriptionManager();
    const connector = CapiConnectorFactory.create({
      config: buildConfig(),
      publisher: createFakePublisher(),
      subscriptionManager,
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
      capiClient: createFakeCapiClient(),
    });
    connector.eventListenerService.start();
    expect(subscriptionManager.count).toBe(4);
  });
});
