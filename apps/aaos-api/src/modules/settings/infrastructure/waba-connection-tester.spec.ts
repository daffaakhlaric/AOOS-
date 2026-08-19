import { afterEach, describe, expect, it, vi } from "vitest";

import { testWabaConnection } from "./waba-connection-tester.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("testWabaConnection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success with the verified name on a 200 response", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ verified_name: "DSS Motor Bintaro", quality_rating: "GREEN" }),
    ) as unknown as typeof fetch;
    const result = await testWabaConnection("phone-1", "token-1");
    expect(result.success).toBe(true);
    expect(result.message).toContain("DSS Motor Bintaro");
  });

  it("returns failure with Meta's error message on a non-2xx response", async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "Invalid OAuth access token" } }, 401),
    ) as unknown as typeof fetch;
    const result = await testWabaConnection("phone-1", "bad-token");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid OAuth access token");
  });

  it("returns failure on a network error", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await testWabaConnection("phone-1", "token-1");
    expect(result.success).toBe(false);
    expect(result.message).toContain("ECONNREFUSED");
  });

  it("returns failure on a non-JSON response body", async () => {
    global.fetch = vi.fn(
      async () => new Response("not json", { status: 200 }),
    ) as unknown as typeof fetch;
    const result = await testWabaConnection("phone-1", "token-1");
    expect(result.success).toBe(false);
  });
});
