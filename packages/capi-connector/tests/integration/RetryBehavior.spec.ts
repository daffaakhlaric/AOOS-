import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { EventBatcherService } from "../../src/application/services/EventBatcherService.js";
import { CapiEvent } from "../../src/domain/entities/CapiEvent.js";
import { CapiConnectorEvents } from "../../src/domain/events/CapiConnectorEvents.js";
import { ActionSource } from "../../src/domain/value-objects/ActionSource.js";
import { EventName } from "../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../src/domain/value-objects/HashedPhone.js";
import { MetaCapiClient } from "../../src/infrastructure/meta-api/MetaCapiClient.js";
import { ExponentialBackoffRetry } from "../../src/infrastructure/retry/ExponentialBackoffRetry.js";
import { buildConfig } from "../helpers/config.js";
import { mswServer } from "../helpers/msw.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";
const ctx = { tenantId: "dss-motor", correlationId: "corr-1" };

function makeEvent(): CapiEvent {
  return unwrap(
    CapiEvent.create({
      eventName: EventName.CONTACT,
      eventTime: unwrap(EventTime.fromDate(new Date("2024-08-09T14:03:00.000Z"))),
      eventSourceUrl: unwrap(EventSourceUrl.create("https://mobixbydss.id")),
      actionSource: ActionSource.website(),
      userData: {
        ph: [unwrap(HashedPhone.create("a".repeat(64)))],
        country: ["x"],
        clientUserAgent: "",
      },
    }),
  );
}

function makeBatcher() {
  const client = new MetaCapiClient();
  const events = new CapiConnectorEvents(createFakePublisher());
  const retry = new ExponentialBackoffRetry({ sleep: async () => undefined, maxAttempts: 3 });
  const config = buildConfig({ pixelId: "123456789", batchSize: 1 });
  return new EventBatcherService(config, client, retry, events, () => new Date());
}

describe("Retry behavior over the real MSW-mocked Meta CAPI (via MetaCapiClient + ExponentialBackoffRetry)", () => {
  it("429 response -> retry after delay -> success", async () => {
    let attempts = 0;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () => {
        attempts += 1;
        if (attempts < 2) {
          return HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 });
        }
        return HttpResponse.json({ events_received: 1, fbtrace_id: "trace-1" });
      }),
    );
    const batcher = makeBatcher();
    const result = unwrap(await batcher.add(makeEvent(), ctx));
    expect(result[0]).toEqual({
      eventName: EventName.CONTACT,
      success: true,
      fbtraceId: "trace-1",
    });
    expect(attempts).toBe(2);
  });

  it("3 consecutive 429 -> CapiApiError after max attempts", async () => {
    let attempts = 0;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () => {
        attempts += 1;
        return HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 });
      }),
    );
    const batcher = makeBatcher();
    const error = unwrapErr(await batcher.add(makeEvent(), ctx));
    expect(error.httpStatus).toBe(429);
    expect(attempts).toBe(3);
  });

  it("400 -> immediate CapiApiError (no retry)", async () => {
    let attempts = 0;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () => {
        attempts += 1;
        return HttpResponse.json({ error: { message: "bad request", code: 100 } }, { status: 400 });
      }),
    );
    const batcher = makeBatcher();
    const error = unwrapErr(await batcher.add(makeEvent(), ctx));
    expect(error.httpStatus).toBe(400);
    expect(attempts).toBe(1);
  });

  it("500 is retryable, eventually succeeding", async () => {
    let attempts = 0;
    mswServer.use(
      http.post(`${BASE}/123456789/events`, () => {
        attempts += 1;
        if (attempts < 3) {
          return HttpResponse.json({ error: { message: "server error" } }, { status: 500 });
        }
        return HttpResponse.json({ events_received: 1 });
      }),
    );
    const batcher = makeBatcher();
    const result = unwrap(await batcher.add(makeEvent(), ctx));
    expect(result[0]?.success).toBe(true);
    expect(attempts).toBe(3);
  });
});
