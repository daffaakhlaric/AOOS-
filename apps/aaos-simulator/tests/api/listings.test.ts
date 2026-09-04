import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/listings/route";
import type { ApiErrorResponse, FetchActiveListingsResponse } from "@/types/simulator.types";

function requestWithQuery(query: string): NextRequest {
  return { nextUrl: new URL(`http://localhost/api/listings${query}`) } as unknown as NextRequest;
}

/**
 * `GET /api/listings?tenantId=...` (this task) — thin proxy to
 * `src/lib/aaos-api-client.ts`'s `fetchActiveListings`. Only `global.fetch` is ever stubbed.
 */
describe("GET /api/listings", () => {
  const originalBaseUrl = process.env["AAOS_API_BASE_URL"];
  const originalApiKey = process.env["AAOS_API_KEY"];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) {
      delete process.env["AAOS_API_BASE_URL"];
    } else {
      process.env["AAOS_API_BASE_URL"] = originalBaseUrl;
    }
    if (originalApiKey === undefined) {
      delete process.env["AAOS_API_KEY"];
    } else {
      process.env["AAOS_API_KEY"] = originalApiKey;
    }
  });

  it("returns 400 when tenantId query param is missing", async () => {
    const response = await GET(requestWithQuery(""));
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.message).toContain("tenantId");
  });

  it("returns 200 with an honest ok:false when AAOS_API_BASE_URL/AAOS_API_KEY are not configured", async () => {
    delete process.env["AAOS_API_BASE_URL"];
    delete process.env["AAOS_API_KEY"];

    const response = await GET(requestWithQuery("?tenantId=agen-pintar-indonesia"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as FetchActiveListingsResponse;
    expect(body.ok).toBe(false);
  });

  it("returns 200 with the real active listing list, forwarding tenantId to apps/aaos-api", async () => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            listings: [
              {
                id: "listing-1",
                title: "Rumah Minimalis Cinere",
                propertyType: "RUMAH",
                price: 1_500_000_000,
              },
            ],
            total: 1,
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(requestWithQuery("?tenantId=agen-pintar-indonesia"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as FetchActiveListingsResponse;
    expect(body).toEqual({
      ok: true,
      listings: [
        {
          id: "listing-1",
          title: "Rumah Minimalis Cinere",
          propertyType: "RUMAH",
          price: 1_500_000_000,
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect((init.headers as Record<string, string>)["x-tenant-id"]).toBe("agen-pintar-indonesia");
  });
});
