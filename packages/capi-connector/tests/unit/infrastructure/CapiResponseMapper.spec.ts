import { err } from "@aos/common";
import { ValidationError } from "@aos/errors";
import { describe, expect, it, vi } from "vitest";

import { EmqReport } from "../../../src/domain/entities/EmqReport.js";
import { CapiResponseMapper } from "../../../src/infrastructure/meta-api/CapiResponseMapper.js";

describe("CapiResponseMapper", () => {
  describe("toSendEventsResult", () => {
    it("maps events_received/fbtrace_id/messages", () => {
      const result = CapiResponseMapper.toSendEventsResult({
        events_received: 1,
        fbtrace_id: "trace-1",
        messages: ["ok"],
      });
      expect(result).toEqual({ eventsReceived: 1, fbtraceId: "trace-1", messages: ["ok"] });
    });

    it("tolerates a response with no fbtrace_id/messages", () => {
      const result = CapiResponseMapper.toSendEventsResult({ events_received: 1 });
      expect(result).toEqual({ eventsReceived: 1, fbtraceId: undefined, messages: undefined });
    });
  });

  describe("toEmqReport", () => {
    it("averages emq across all reported event types and sums events_received", () => {
      const report = CapiResponseMapper.toEmqReport(
        "pixel-1",
        {
          id: "pixel-1",
          server_events_metrics: {
            data: [
              { emq: 8, events_received: 10 },
              { emq: 6, events_received: 20 },
            ],
          },
        },
        new Date("2026-01-01T00:00:00.000Z"),
      );
      expect(report.score.value).toBe(7);
      expect(report.eventsReceived).toBe(30);
      expect(report.pixelId).toBe("pixel-1");
    });

    it("defaults to score 0 / eventsReceived 0 when server_events_metrics is absent", () => {
      const report = CapiResponseMapper.toEmqReport("pixel-1", { id: "pixel-1" }, new Date());
      expect(report.score.value).toBe(0);
      expect(report.eventsReceived).toBe(0);
    });

    it("clamps an out-of-range average score into [0, 10]", () => {
      const report = CapiResponseMapper.toEmqReport(
        "pixel-1",
        { id: "pixel-1", server_events_metrics: { data: [{ emq: 15, events_received: 1 }] } },
        new Date(),
      );
      expect(report.score.value).toBe(10);
    });

    it("throws (does not silently swallow) if EmqReport.create ever rejected its own guaranteed-valid inputs (defensive path)", () => {
      const spy = vi
        .spyOn(EmqReport, "create")
        .mockReturnValueOnce(err(new ValidationError("unreachable")));
      expect(() =>
        CapiResponseMapper.toEmqReport("pixel-1", { id: "pixel-1" }, new Date()),
      ).toThrow("unreachable");
      spy.mockRestore();
    });
  });

  describe("toCapiApiError", () => {
    it("maps Meta error code 190 to httpStatus 401", async () => {
      const response = new Response(
        JSON.stringify({ error: { message: "invalid token", code: 190 } }),
        {
          status: 400,
        },
      );
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.httpStatus).toBe(401);
      expect(error.metaErrorCode).toBe(190);
      expect(error.message).toBe("invalid token");
    });

    it("maps Meta error code 200 to httpStatus 403", async () => {
      const response = new Response(
        JSON.stringify({ error: { message: "missing permission", code: 200 } }),
        {
          status: 400,
        },
      );
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.httpStatus).toBe(403);
    });

    it("maps HTTP 429 with a retryAfterMs context", async () => {
      const response = new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "retry-after": "5" },
      });
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.httpStatus).toBe(429);
      expect(error.context).toEqual({ retryAfterMs: 5000 });
    });

    it("defaults retryAfterMs when the retry-after header is not a valid number", async () => {
      const response = new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
        headers: { "retry-after": "not-a-number" },
      });
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.context).toEqual({ retryAfterMs: 60_000 });
    });

    it("defaults retryAfterMs when the retry-after header is absent", async () => {
      const response = new Response(JSON.stringify({ error: { message: "rate limited" } }), {
        status: 429,
      });
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.context).toEqual({ retryAfterMs: 60_000 });
    });

    it("falls back to a generic HTTP-status message on a non-JSON error body", async () => {
      const response = new Response("not json", { status: 500 });
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.httpStatus).toBe(500);
      expect(error.message).toBe("Meta CAPI request failed with HTTP 500");
    });

    it("passes through an arbitrary non-190/200/429 error code/status", async () => {
      const response = new Response(
        JSON.stringify({ error: { message: "server error", code: 1 } }),
        {
          status: 500,
        },
      );
      const error = await CapiResponseMapper.toCapiApiError(response);
      expect(error.httpStatus).toBe(500);
      expect(error.metaErrorCode).toBe(1);
    });
  });
});
