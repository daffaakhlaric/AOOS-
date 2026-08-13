import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CapiConnectorFactory } from "../../src/factories/CapiConnectorFactory.js";
import { MetaCapiClient } from "../../src/infrastructure/meta-api/MetaCapiClient.js";
import { buildConfig } from "../helpers/config.js";
import { createFakeClosingRepository, createGetLead } from "../helpers/lead-store-fakes.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap } from "../helpers/result.js";
import { createFakeSubscriptionManager } from "../helpers/subscription-manager.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

describe("SendContactEvent (MSW-mocked Meta CAPI)", () => {
  it("LeadCreated -> Contact event sent, event_time = unix timestamp of occurredAt", async () => {
    let requestBody: unknown;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ events_received: 1, fbtrace_id: "trace-1" });
      }),
    );

    const connector = CapiConnectorFactory.create({
      config: buildConfig({ pixelId: "123456789" }),
      publisher: createFakePublisher(),
      subscriptionManager: createFakeSubscriptionManager(),
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
      capiClient: new MetaCapiClient(),
    });

    const result = unwrap(
      await connector.sendContactEvent.execute({
        phone: "+628123456789",
        adId: "ad-1",
        campaignId: "camp-1",
        occurredAt: new Date("2024-08-09T14:03:00.000Z"),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    expect(result.success).toBe(true);
    const body = requestBody as { data: Array<{ event_name: string; event_time: number }> };
    expect(body.data[0]?.event_name).toBe("Contact");
    expect(body.data[0]?.event_time).toBe(1723212180);
  });
});
