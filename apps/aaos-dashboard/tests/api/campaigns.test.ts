import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/campaigns/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/campaigns");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

const AD_ACCOUNT_RESPONSE = {
  id: "act_1",
  name: "Mobix Main",
  syncedAt: "2026-08-11T00:00:00.000Z",
  campaigns: [
    {
      name: "Meta-DM-Leads-Mobix",
      adSets: [
        {
          ads: [
            {
              id: "ad-1",
              name: "#A001",
              status: "ACTIVE",
              funnel: "DM",
              branch: "BINTARO",
              verdict: "REVIEW",
              metrics: {
                spend: 6_000_000,
                conversations: 790,
                d2: 400,
                d3: 307,
                d5: 100,
                leadForm: 20,
                totalLead: 320,
                rphD3: 19_541,
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("GET /api/campaigns", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api and flattens campaigns/adSets/ads into a single ad list", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET(requestWith({ datePreset: "last_30d" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ads: unknown[]; totals: { spend: number } };
    expect(body.ads).toHaveLength(1);
    expect(body.totals.spend).toBe(6_000_000);
  });

  it("passes adAccountId/datePreset through as query params to aaos-api", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await GET(requestWith({ adAccountId: "act_1", datePreset: "last_7d" }));

    const [url] = fetchMock.mock.calls[0]!;
    expect(url.toString()).toContain("adAccountId=act_1");
    expect(url.toString()).toContain("datePreset=last_7d");
  });

  it("returns the upstream error status when aaos-api fails", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "bad request" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const response = await GET(requestWith());
    expect(response.status).toBe(422);
  });

  it("returns 500 when fetch itself throws (network failure)", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const response = await GET(requestWith());
    expect(response.status).toBe(500);
  });
});
