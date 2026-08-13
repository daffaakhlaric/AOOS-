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

describe("SendPurchaseEvent (MSW-mocked Meta CAPI)", () => {
  it("SPK closing -> Purchase event sent with correct payload; phone hashed; EventSent + BatchCompleted emitted", async () => {
    let requestBody: unknown;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ events_received: 1, fbtrace_id: "trace-1" });
      }),
    );

    const publisher = createFakePublisher();
    const connector = CapiConnectorFactory.create({
      config: buildConfig({ pixelId: "123456789" }),
      publisher,
      subscriptionManager: createFakeSubscriptionManager(),
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
      capiClient: new MetaCapiClient(),
    });

    const result = unwrap(
      await connector.sendPurchaseEvent.execute({
        phone: "+628123456789",
        unitId: "unit-123",
        unitPrice: 195_000_000,
        occurredAt: new Date("2024-08-09T14:03:00.000Z"),
        tenantId: "dss-motor",
        correlationId: "corr-1",
      }),
    );

    expect(result.success).toBe(true);
    expect(result.eventName).toBe("Purchase");

    const body = requestBody as {
      data: Array<{
        event_name: string;
        user_data: { ph: string[] };
        custom_data: { value: number; currency: string };
      }>;
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.event_name).toBe("Purchase");
    expect(body.data[0]?.custom_data.value).toBe(195_000_000);
    expect(body.data[0]?.custom_data.currency).toBe("IDR");
    // sha256("628123456789")
    expect(body.data[0]?.user_data.ph).toEqual([
      "4ae87a9fd91110f0288ac5bea87a099ca5ee72e032908dbf5ee56f9512bbff43",
    ]);

    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.event.sent")).toBe(true);
    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.batch.completed")).toBe(
      true,
    );
  });

  it("does not publish EventSent/BatchCompleted when Meta CAPI rejects the request", async () => {
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () =>
        HttpResponse.json({ error: { message: "bad request", code: 100 } }, { status: 400 }),
      ),
    );

    const publisher = createFakePublisher();
    const connector = CapiConnectorFactory.create({
      config: buildConfig({ pixelId: "123456789" }),
      publisher,
      subscriptionManager: createFakeSubscriptionManager(),
      getLead: createGetLead(),
      closingRepository: createFakeClosingRepository(),
      capiClient: new MetaCapiClient(),
    });

    const result = await connector.sendPurchaseEvent.execute({
      phone: "+628123456789",
      unitId: "unit-123",
      unitPrice: 195_000_000,
      occurredAt: new Date("2024-08-09T14:03:00.000Z"),
      tenantId: "dss-motor",
      correlationId: "corr-1",
    });

    expect(result.ok).toBe(false);
    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.event.sent")).toBe(
      false,
    );
    expect(publisher.published.some((p) => p.type === "aaos.capi-connector.event.failed")).toBe(
      true,
    );
  });
});
