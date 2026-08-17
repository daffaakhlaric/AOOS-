import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/meta-ads-accounts/route";

describe("GET /api/meta-ads-accounts", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's GET /api/v1/meta-ads/accounts", async () => {
    const body = [
      { id: "act_1", name: "DSS Motor" },
      { id: "act_2", name: "Pusat Grosir Mobil" },
    ];
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/meta-ads/accounts");
      return new Response(JSON.stringify(body), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "aaos-api unreachable" }), { status: 503 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(503);
  });
});
