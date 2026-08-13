import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AaosApiError, callAaosApi } from "@/lib/api";

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
