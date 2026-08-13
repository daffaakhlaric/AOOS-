import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { CapiBatch } from "../../../src/domain/entities/CapiBatch.js";
import { CapiEvent } from "../../../src/domain/entities/CapiEvent.js";
import { ActionSource } from "../../../src/domain/value-objects/ActionSource.js";
import { EventName } from "../../../src/domain/value-objects/EventName.js";
import { EventSourceUrl } from "../../../src/domain/value-objects/EventSourceUrl.js";
import { EventTime } from "../../../src/domain/value-objects/EventTime.js";
import { HashedPhone } from "../../../src/domain/value-objects/HashedPhone.js";
import { MetaCapiClient } from "../../../src/infrastructure/meta-api/MetaCapiClient.js";
import { buildConfig } from "../../helpers/config.js";
import { mswServer } from "../../helpers/msw.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

beforeAll(() => mswServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mswServer.resetHandlers());
afterAll(() => mswServer.close());

const BASE = "https://graph.facebook.com/v21.0";

function makeBatch(): CapiBatch {
  const event = unwrap(
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
  return unwrap(CapiBatch.create([event]));
}

describe("MetaCapiClient", () => {
  describe("sendEvents", () => {
    it("POSTs the correct endpoint: /v21.0/{pixelId}/events", async () => {
      let requestedUrl: string | undefined;
      mswServer.use(
        http.post(`${BASE}/123456789/events`, ({ request }) => {
          requestedUrl = request.url;
          return HttpResponse.json({ events_received: 1, fbtrace_id: "trace-1" });
        }),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const result = unwrap(await client.sendEvents(makeBatch(), config));
      expect(requestedUrl).toBe(`${BASE}/123456789/events`);
      expect(result).toEqual({ eventsReceived: 1, fbtraceId: "trace-1", messages: undefined });
    });

    it("access_token travels in the body, not a header", async () => {
      let body: unknown;
      let authHeader: string | null = null;
      mswServer.use(
        http.post(`${BASE}/123456789/events`, async ({ request }) => {
          body = await request.json();
          authHeader = request.headers.get("authorization");
          return HttpResponse.json({ events_received: 1 });
        }),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789", accessToken: "TOKEN123" });
      await client.sendEvents(makeBatch(), config);
      expect((body as { access_token: string }).access_token).toBe("TOKEN123");
      expect(authHeader).toBeNull();
    });

    it("429 -> CapiApiError with httpStatus 429", async () => {
      mswServer.use(
        http.post(`${BASE}/123456789/events`, () =>
          HttpResponse.json({ error: { message: "rate limited" } }, { status: 429 }),
        ),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.httpStatus).toBe(429);
    });

    it("400 -> CapiApiError, no retry built into the client itself", async () => {
      mswServer.use(
        http.post(`${BASE}/123456789/events`, () =>
          HttpResponse.json({ error: { message: "bad request", code: 100 } }, { status: 400 }),
        ),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.httpStatus).toBe(400);
    });

    it("aborts and returns a CapiApiError when the request exceeds timeoutMs", async () => {
      const client = new MetaCapiClient({
        timeoutMs: 5,
        fetchImpl: (_url, init) =>
          new Promise((_resolve, reject) => {
            const signal = (init as RequestInit).signal;
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      });
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.message).toContain("Meta CAPI network failure");
    });

    it("returns a CapiApiError with a String()-ed message when the fetch throws a non-Error value", async () => {
      const client = new MetaCapiClient({
        fetchImpl: async () => {
          throw "raw string failure";
        },
      });
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.message).toBe("Meta CAPI network failure: raw string failure");
    });

    it("returns a CapiApiError on a network failure", async () => {
      const client = new MetaCapiClient({
        fetchImpl: async () => {
          throw new Error("ECONNRESET");
        },
      });
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.message).toContain("Meta CAPI network failure");
    });

    it("returns a CapiApiError on a non-JSON response body", async () => {
      mswServer.use(
        http.post(`${BASE}/123456789/events`, () => new HttpResponse("not json", { status: 200 })),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.message).toContain("non-JSON response body");
    });

    it("returns a CapiApiError when the response fails schema validation", async () => {
      mswServer.use(
        http.post(`${BASE}/123456789/events`, () => HttpResponse.json({ unexpected: true })),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.sendEvents(makeBatch(), config));
      expect(error.message).toContain("failed schema validation");
    });

    it("includes test_event_code in the body when configured", async () => {
      let body: unknown;
      mswServer.use(
        http.post(`${BASE}/123456789/events`, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ events_received: 1 });
        }),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789", testEventCode: "TEST12345" });
      await client.sendEvents(makeBatch(), config);
      expect((body as { test_event_code: string }).test_event_code).toBe("TEST12345");
    });
  });

  describe("getEmqScore", () => {
    it("GETs the diagnostics endpoint and maps the response to an EmqReport", async () => {
      mswServer.use(
        http.get(`${BASE}/123456789`, () =>
          HttpResponse.json({
            id: "123456789",
            server_events_metrics: { data: [{ emq: 8, events_received: 5 }] },
          }),
        ),
      );
      const client = new MetaCapiClient({ now: () => new Date("2026-01-01T00:00:00.000Z") });
      const config = buildConfig({ pixelId: "123456789" });
      const report = unwrap(await client.getEmqScore(config));
      expect(report.score.value).toBe(8);
      expect(report.eventsReceived).toBe(5);
      expect(report.capturedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    });

    it("defaults `now` to the real clock when not provided", async () => {
      mswServer.use(
        http.get(`${BASE}/123456789`, () =>
          HttpResponse.json({ id: "123456789", server_events_metrics: { data: [] } }),
        ),
      );
      const before = Date.now();
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const report = unwrap(await client.getEmqScore(config));
      expect(report.capturedAt.getTime()).toBeGreaterThanOrEqual(before);
    });

    it("returns a CapiApiError on an error response", async () => {
      mswServer.use(
        http.get(`${BASE}/123456789`, () =>
          HttpResponse.json({ error: { message: "invalid token", code: 190 } }, { status: 400 }),
        ),
      );
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.getEmqScore(config));
      expect(error.httpStatus).toBe(401);
    });

    it("returns a CapiApiError on a non-JSON response body", async () => {
      mswServer.use(http.get(`${BASE}/123456789`, () => new HttpResponse("nope", { status: 200 })));
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.getEmqScore(config));
      expect(error.message).toContain("non-JSON response body");
    });

    it("returns a CapiApiError when the response fails schema validation", async () => {
      mswServer.use(http.get(`${BASE}/123456789`, () => HttpResponse.json({ nope: true })));
      const client = new MetaCapiClient();
      const config = buildConfig({ pixelId: "123456789" });
      const error = unwrapErr(await client.getEmqScore(config));
      expect(error.message).toContain("failed schema validation");
    });
  });
});
