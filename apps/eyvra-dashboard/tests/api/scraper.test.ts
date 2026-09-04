import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getJob } from "@/app/api/scraper/jobs/[jobId]/route";
import { GET as getStream } from "@/app/api/scraper/jobs/[jobId]/stream/route";
import { POST as postRun } from "@/app/api/scraper/run/route";
import { GET as getStatus } from "@/app/api/scraper/status/route";
import { GET as getStock } from "@/app/api/scraper/stock/route";
import { GET as getUnit } from "@/app/api/scraper/stock/[unitId]/route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("scraper proxy routes", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/scraper/status", () => {
    it("proxies GET /api/v1/scraper/status with the server-only x-api-key", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ totalUnits: 48, availableUnits: 45, totalPhotos: 312, byBranch: {} }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await getStatus();
      expect(response.status).toBe(200);
      const body = (await response.json()) as { totalUnits: number };
      expect(body.totalUnits).toBe(48);

      const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect(String(url)).toBe("http://localhost:3000/api/v1/scraper/status");
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    });

    it("passes through an upstream 503 (GCS/scraped_units not configured)", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "scraped_units not configured" }, 503),
      ) as unknown as typeof fetch;

      const response = await getStatus();
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { message: string } };
      expect(body.error.message).toBe("scraped_units not configured");
    });
  });

  describe("GET /api/scraper/stock", () => {
    it("forwards only the filters actually present in the request", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ units: [], total: 0, page: 1, limit: 50 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await getStock(
        new Request(
          "http://localhost/api/scraper/stock?branch=CINERE&search=xpander&page=2",
        ) as never,
      );

      const [url] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(url.searchParams.get("branch")).toBe("CINERE");
      expect(url.searchParams.get("search")).toBe("xpander");
      expect(url.searchParams.get("page")).toBe("2");
      // Absent filters are not sent as empty strings (which aaos-api's Zod schema would reject).
      expect(url.searchParams.has("available")).toBe(false);
      expect(url.searchParams.has("limit")).toBe(false);
    });

    it("passes through an upstream 422 for a fabricated branch", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "Request validation failed: branch" }, 422),
      ) as unknown as typeof fetch;

      const response = await getStock(
        new Request("http://localhost/api/scraper/stock?branch=PONDOK_BAMBU") as never,
      );
      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/scraper/stock/:unitId", () => {
    it("URL-encodes the unit id", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ unitId: "a b" }));
      global.fetch = fetchMock as unknown as typeof fetch;

      await getUnit(new Request("http://localhost") as never, { params: { unitId: "a b" } });
      const [url] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(String(url)).toBe("http://localhost:3000/api/v1/scraper/stock/a%20b");
    });

    it("passes through an upstream 404", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "No scraped unit found" }, 404),
      ) as unknown as typeof fetch;
      const response = await getUnit(new Request("http://localhost") as never, {
        params: { unitId: "nope" },
      });
      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/scraper/run", () => {
    it("returns 202 with the jobId (the scrape runs detached upstream)", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ jobId: "job-1", status: "RUNNING", kind: "FULL" }, 202),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await postRun(
        new Request("http://localhost/api/scraper/run", {
          method: "POST",
          body: JSON.stringify({}),
        }) as never,
      );
      expect(response.status).toBe(202);
      const body = (await response.json()) as { jobId: string };
      expect(body.jobId).toBe("job-1");
    });

    it("forwards a unitUrl body for a single-unit re-scrape", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ jobId: "job-2", status: "RUNNING", kind: "UNIT" }, 202),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await postRun(
        new Request("http://localhost/api/scraper/run", {
          method: "POST",
          body: JSON.stringify({ unitUrl: "https://mobixbydss.id/unit/brio-a" }),
        }) as never,
      );
      const [, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({
        unitUrl: "https://mobixbydss.id/unit/brio-a",
      });
    });

    it("tolerates a missing/invalid JSON body by sending {}", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ jobId: "job-3" }, 202));
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await postRun(
        new Request("http://localhost/api/scraper/run", {
          method: "POST",
          body: "not json",
        }) as never,
      );
      expect(response.status).toBe(202);
      const [, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect(JSON.parse(String(init.body))).toEqual({});
    });
  });

  describe("GET /api/scraper/jobs/:jobId", () => {
    it("proxies the persisted job (the polling fallback for the progress modal)", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ id: "job-1", status: "DONE", logs: [] }),
      ) as unknown as typeof fetch;

      const response = await getJob(new Request("http://localhost") as never, {
        params: { jobId: "job-1" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { status: string };
      expect(body.status).toBe("DONE");
    });
  });

  describe("GET /api/scraper/jobs/:jobId/stream (SSE proxy)", () => {
    it("pipes the upstream event stream through with SSE headers and the api key attached", async () => {
      const upstreamBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"status":"DONE"}\n\n'));
          controller.close();
        },
      });
      const fetchMock = vi.fn(
        async () =>
          new Response(upstreamBody, {
            status: 200,
            headers: { "content-type": "text/event-stream" },
          }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await getStream(new Request("http://localhost") as never, {
        params: { jobId: "job-1" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(response.headers.get("cache-control")).toContain("no-cache");
      // Disables proxy buffering on hosts that honor it, so frames are not withheld until close.
      expect(response.headers.get("x-accel-buffering")).toBe("no");

      // The API key is attached server-side — the browser's EventSource could never send it.
      const [, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");

      expect(await response.text()).toContain('data: {"status":"DONE"}');
    });

    it("passes through an upstream 401/404 as JSON rather than an empty stream", async () => {
      global.fetch = vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "No scrape job found" }), { status: 404 }),
      ) as unknown as typeof fetch;

      const response = await getStream(new Request("http://localhost") as never, {
        params: { jobId: "nope" },
      });
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: { message: string } };
      expect(body.error.message).toBe("No scrape job found");
    });

    it("returns 502 when upstream responds 200 with no body at all", async () => {
      global.fetch = vi.fn(
        async () => new Response(null, { status: 200 }),
      ) as unknown as typeof fetch;

      const response = await getStream(new Request("http://localhost") as never, {
        params: { jobId: "job-1" },
      });
      expect(response.status).toBe(502);
    });
  });
});
