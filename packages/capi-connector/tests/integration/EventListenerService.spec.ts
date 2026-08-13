import { EventBroker } from "@aos/event-bus";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CapiConnectorFactory } from "../../src/factories/CapiConnectorFactory.js";
import { MetaCapiClient } from "../../src/infrastructure/meta-api/MetaCapiClient.js";
import { buildConfig } from "../helpers/config.js";
import { dispatchViaSubscriptionManager } from "../helpers/dispatch.js";
import {
  buildClosing,
  buildLead,
  createFakeClosingRepository,
  createGetLead,
  makeEvent,
} from "../helpers/lead-store-fakes.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";
const occurredAt = new Date("2024-08-09T14:03:00.000Z");

/**
 * Wires `EventListenerService` to a REAL `@aos/event-bus` `SubscriptionManager`
 * (`EventBroker.subscriptions`) — proving coordinator note #1's `.subscribe({ criteria: {
 * topic }, handler })` call against the real interface, real `EventRouter` topic matching, and
 * real subscription-id bookkeeping. Events are delivered via `dispatchViaSubscriptionManager`
 * (see that helper's docstring for why `EventBroker.publish()` itself can't be used here — an
 * unrelated, pre-existing `@aos/event-bus` schema/naming-convention gap, not specific to this
 * package). `CapiConnectorEvents`' own outbound publishes go through a fake `IPublisher`
 * for the same reason (already covered by unit tests exercising the real
 * `CapiConnectorEvents` class directly).
 */
function makeConnector(
  overrides: {
    lead?: ReturnType<typeof buildLead>;
    closing?: ReturnType<typeof buildClosing>;
  } = {},
) {
  const broker = new EventBroker();
  const lead = overrides.lead ?? buildLead({ leadPhone: "+628123456789", adId: "ad-1" });
  const connector = CapiConnectorFactory.create({
    config: buildConfig({ pixelId: "123456789" }),
    publisher: createFakePublisher(),
    subscriptionManager: broker.subscriptions,
    getLead: createGetLead([lead]),
    closingRepository: createFakeClosingRepository(overrides.closing ? [overrides.closing] : []),
    capiClient: new MetaCapiClient(),
  });
  connector.eventListenerService.start();
  return { broker, connector, lead };
}

function useMswCaptureEventNames(): string[] {
  const sentNames: string[] = [];
  mswServer.use(
    http.post(`${BASE}/123456789/events`, async ({ request }) => {
      const body = (await request.json()) as { data: Array<{ event_name: string }> };
      sentNames.push(...body.data.map((d) => d.event_name));
      return HttpResponse.json({ events_received: 1 });
    }),
  );
  return sentNames;
}

describe("EventListenerService (real @aos/event-bus SubscriptionManager + MSW-mocked Meta CAPI)", () => {
  it("'aaos.lead-store.lead.created' -> Contact event sent to CAPI", async () => {
    const sentNames = useMswCaptureEventNames();
    const { broker } = makeConnector();

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.lead.created", {
        leadId: "lead-1",
        leadPhone: "+628123456789",
        branchId: "branch-1",
        leadSource: "CTWA",
        adId: "ad-1",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(sentNames).toEqual(["Contact"]);
  });

  it("'aaos.lead-store.lead.became-hot' -> AddToWishlist sent", async () => {
    const sentNames = useMswCaptureEventNames();
    const lead = buildLead({ leadPhone: "+628123456789", adId: "ad-1" });
    const { broker } = makeConnector({ lead });

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.lead.became-hot", {
        leadId: lead.id.toString(),
        branchId: "branch-1",
        score: 70,
        becameHotAt: occurredAt,
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(sentNames).toEqual(["AddToWishlist"]);
  });

  it("'aaos.lead-store.closing.recorded' SPK -> Purchase sent", async () => {
    const sentNames = useMswCaptureEventNames();
    const lead = buildLead({ leadPhone: "+628123456789" });
    const closing = buildClosing({
      closingType: "SPK" as never,
      unitId: "unit-1",
      unitPrice: 195_000_000,
    });
    const { broker } = makeConnector({ lead, closing });

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "SPK",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(sentNames).toEqual(["Purchase"]);
  });

  it("'aaos.lead-store.closing.recorded' TEST_DRIVE -> Lead sent", async () => {
    const sentNames = useMswCaptureEventNames();
    const lead = buildLead({ leadPhone: "+628123456789" });
    const closing = buildClosing({ closingType: "TEST_DRIVE" as never, unitId: "unit-1" });
    const { broker } = makeConnector({ lead, closing });

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.closing.recorded", {
        closingId: closing.id.toString(),
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "TEST_DRIVE",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(sentNames).toEqual(["Lead"]);
  });

  it("'aaos.lead-store.lead.score-updated' crossing 30 -> InitiateCheckout sent; re-crossing again does NOT re-send", async () => {
    const sentNames = useMswCaptureEventNames();
    const lead = buildLead({ leadPhone: "+628123456789" });
    const { broker } = makeConnector({ lead });

    const dispatchScoreUpdated = (scoreBefore: number, scoreAfter: number) =>
      dispatchViaSubscriptionManager(
        broker.subscriptions,
        makeEvent("aaos.lead-store.lead.score-updated", {
          leadId: lead.id.toString(),
          scoreBefore,
          scoreAfter,
          delta: scoreAfter - scoreBefore,
          reason: "qualification",
          tenantId: "dss-motor",
          correlationId: "corr-1",
          occurredAt,
          version: "1.0",
        }),
      );

    await dispatchScoreUpdated(20, 35);
    await dispatchScoreUpdated(35, 50);

    expect(sentNames).toEqual(["InitiateCheckout"]);
  });

  it("CANCELLED closing sends nothing to Meta CAPI", async () => {
    let called = false;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () => {
        called = true;
        return HttpResponse.json({ events_received: 1 });
      }),
    );
    const lead = buildLead({ leadPhone: "+628123456789" });
    const { broker } = makeConnector({ lead });

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.closing.recorded", {
        closingId: "closing-1",
        leadId: lead.id.toString(),
        branchId: "branch-1",
        closingType: "CANCELLED",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(called).toBe(false);
  });

  it("stop() unsubscribes from the real SubscriptionManager, so a later dispatch reaches nothing", async () => {
    const sentNames = useMswCaptureEventNames();
    const { broker, connector } = makeConnector();
    connector.eventListenerService.stop();

    await dispatchViaSubscriptionManager(
      broker.subscriptions,
      makeEvent("aaos.lead-store.lead.created", {
        leadId: "lead-1",
        leadPhone: "+628123456789",
        branchId: "branch-1",
        leadSource: "CTWA",
        tenantId: "dss-motor",
        correlationId: "corr-1",
        occurredAt,
        version: "1.0",
      }),
    );

    expect(sentNames).toEqual([]);
  });
});
