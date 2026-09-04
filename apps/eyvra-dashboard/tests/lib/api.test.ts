import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AaosApiError, callAaosApi, streamAaosApi } from "@/lib/api";

describe("callAaosApi", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sends the x-api-key header and returns the parsed JSON body on success", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callAaosApi<{ ok: boolean }>("/api/v1/objective");

    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
  });

  it("appends searchParams to the URL, skipping undefined values", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) => new Response("{}", { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await callAaosApi("/api/v1/campaigns", {
      searchParams: { adAccountId: "act_1", datePreset: undefined },
    });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toContain("adAccountId=act_1");
    expect(url.toString()).not.toContain("datePreset");
  });

  it("sends a JSON body + content-type header for POST/PUT requests", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) => new Response("{}", { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await callAaosApi("/api/v1/objective", { method: "POST", body: { targetHotLeads: 50 } });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ targetHotLeads: 50 }));
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("throws AaosApiError with the upstream status code and message on a non-2xx response", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(callAaosApi("/api/v1/objective")).rejects.toMatchObject({
      statusCode: 404,
      message: "not found",
    });
  });

  it("falls back to a generic message when the error body has no message field", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 500 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(callAaosApi("/api/v1/objective")).rejects.toThrow(/failed with status 500/);
  });

  it("handles an empty response body", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await callAaosApi("/api/v1/objective");
    expect(result).toBeUndefined();
  });

  it(
    "throws AaosApiError (never a raw SyntaxError) when the body isn't valid JSON, even on a 2xx " +
      "status (real bug fix regression guard: this used to bypass AaosApiError entirely, surfacing " +
      "as every caller's opaque generic 'Unexpected error' fallback)",
    async () => {
      const fetchMock = vi.fn(async () => new Response("<html>not json</html>", { status: 200 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const rejection = callAaosApi("/api/v1/objective");
      await expect(rejection).rejects.toBeInstanceOf(AaosApiError);
      await expect(rejection).rejects.toMatchObject({ statusCode: 200 });
      await expect(rejection).rejects.toThrow(/non-JSON body/);
    },
  );

  it("throws a plain Error when AAOS_API_BASE_URL is not set", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    await expect(callAaosApi("/api/v1/objective")).rejects.toThrow(/AAOS_API_BASE_URL/);
  });

  it("throws a plain Error when AAOS_API_KEY is not set", async () => {
    delete process.env["AAOS_API_KEY"];
    await expect(callAaosApi("/api/v1/objective")).rejects.toThrow(/AAOS_API_KEY/);
  });

  it("AaosApiError carries statusCode and a matching name", () => {
    const error = new AaosApiError(404, "not found");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("AaosApiError");
    expect(error).toBeInstanceOf(Error);
  });
});

/** AAOS-SCRAPER-ASSET-LIBRARY — the SSE-proxy helper behind `/api/scraper/jobs/:jobId/stream`. */
describe("streamAaosApi", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("sends the x-api-key + event-stream accept header and returns the live Response UNREAD", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {}\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await streamAaosApi("/api/v1/scraper/jobs/job-1/stream");
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://localhost:3000/api/v1/scraper/jobs/job-1/stream");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(headers["accept"]).toBe("text/event-stream");
    // The body must NOT have been consumed — the whole point is to pipe it onward.
    expect(response.bodyUsed).toBe(false);
    expect(await response.text()).toContain("data: {}");
  });

  it("throws AaosApiError carrying the upstream status and message on a non-2xx", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "No scrape job found" }), { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(streamAaosApi("/api/v1/scraper/jobs/nope/stream")).rejects.toMatchObject({
      statusCode: 404,
      message: "No scrape job found",
    });
  });

  it("falls back to a generic message when the upstream error body is not JSON", async () => {
    global.fetch = vi.fn(
      async () => new Response("<html>502</html>", { status: 502 }),
    ) as unknown as typeof fetch;

    await expect(streamAaosApi("/api/v1/scraper/jobs/job-1/stream")).rejects.toThrow(
      /failed with status 502/,
    );
  });

  it("requires the server-only env vars", async () => {
    delete process.env["AAOS_API_KEY"];
    await expect(streamAaosApi("/api/v1/scraper/jobs/job-1/stream")).rejects.toThrow(
      /AAOS_API_KEY/,
    );
  });
});
