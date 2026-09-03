import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/campaigns/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

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
      id: "campaign-1",
      stableId: "#A001",
      name: "Meta-DM-Leads-Mobix",
      objective: "OUTCOME_LEADS",
      status: "ACTIVE",
      spend: 6_000_000,
      adSets: [
        {
          id: "adset-1",
          stableId: "#B001",
          name: "AdSet 1",
          status: "ACTIVE",
          spend: 6_000_000,
          ads: [
            {
              id: "ad-1",
              stableId: "#C001",
              name: "Ad 1",
              status: "ACTIVE",
              funnel: "DM",
              branch: "BINTARO",
              verdict: "REVIEW",
              metrics: {
                spend: 6_000_000,
                clicks: 1200,
                frequency: 2.1,
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
    resolveRouteSession.mockResolvedValue(SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TENANT-SCOPING FIX (Phase T2): this route now resolves the real session and forwards
  // `x-tenant-id` — 401s with no session, same as every other proxy route in this app.
  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(requestWith());
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api, returning both the flattened ad list AND the real hierarchy with its stableIds (real bug fix: this used to discard the hierarchy/stableIds entirely — see route.ts's docstring), forwarding the real per-request tenant id", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith({ datePreset: "last_30d" }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      ads: unknown[];
      totals: { spend: number };
      campaigns: ReadonlyArray<{
        stableId: string;
        adSets: ReadonlyArray<{ stableId: string; ads: ReadonlyArray<{ stableId: string }> }>;
      }>;
      campaignCount: number;
      adCount: number;
    };
    expect(body.ads).toHaveLength(1);
    expect(body.totals.spend).toBe(6_000_000);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0]?.stableId).toBe("#A001");
    expect(body.campaigns[0]?.adSets[0]?.stableId).toBe("#B001");
    expect(body.campaigns[0]?.adSets[0]?.ads[0]?.stableId).toBe("#C001");
    expect(body.campaignCount).toBe(1);
    expect(body.adCount).toBe(1);
  });

  it("passes daysSinceCreation through when the upstream ad has it (AAOS-SAMANTHA-PAGES: powers Audit Biaya's 'Iklan Baru' section)", async () => {
    const withDays = {
      ...AD_ACCOUNT_RESPONSE,
      campaigns: [
        {
          ...AD_ACCOUNT_RESPONSE.campaigns[0]!,
          adSets: [
            {
              ...AD_ACCOUNT_RESPONSE.campaigns[0]!.adSets[0]!,
              ads: [
                { ...AD_ACCOUNT_RESPONSE.campaigns[0]!.adSets[0]!.ads[0]!, daysSinceCreation: 3 },
              ],
            },
          ],
        },
      ],
    };
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(withDays), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET(requestWith({ adAccountId: "act_days_1", datePreset: "last_30d" }));
    const body = (await response.json()) as { ads: ReadonlyArray<{ daysSinceCreation?: number }> };
    expect(body.ads[0]?.daysSinceCreation).toBe(3);
  });

  it("omits daysSinceCreation when the upstream ad doesn't have it", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET(requestWith({ adAccountId: "act_days_2", datePreset: "last_30d" }));
    const body = (await response.json()) as { ads: ReadonlyArray<{ daysSinceCreation?: number }> };
    expect(body.ads[0]?.daysSinceCreation).toBeUndefined();
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

  describe("caching (real bug fix: unbounded aaos-api calls were tripping Meta's rate limit)", () => {
    it("caches a successful response for 15 minutes — a second call with the same adAccountId/datePreset does not call aaos-api again", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const params = { adAccountId: "act_cache_1", datePreset: "last_30d" };
      await GET(requestWith(params));
      await GET(requestWith(params));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Meta rate-limit UX mitigation (docs/PROMPT-AAOS-GEO-TARGETING-AND-REGION-PICKER.md Part C):
    // `CACHE_TTL_MS` was bumped from 5 to 15 minutes (300_000 -> 900_000) — a real, direct
    // mitigation for the Meta Ads Tenant-Scoping Fix's (`c8d739c`) real, accepted tradeoff of
    // increased Meta call volume now that every tenant gets its own real cache key.
    it("re-fetches once the 15-minute TTL has elapsed", async () => {
      vi.useFakeTimers();
      try {
        const fetchMock = vi.fn(
          async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        const params = { adAccountId: "act_cache_2", datePreset: "last_30d" };
        await GET(requestWith(params));
        vi.advanceTimersByTime(900_001);
        await GET(requestWith(params));

        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("bypasses the cache when refresh=1 is passed, even within the 15-minute window (manual 'Tarik Data' / post-Execute re-fetch)", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const params = { adAccountId: "act_cache_3", datePreset: "last_30d" };
      await GET(requestWith(params));
      await GET(requestWith({ ...params, refresh: "1" }));

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("caches distinct adAccountId/datePreset combinations independently", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await GET(requestWith({ adAccountId: "act_cache_4a", datePreset: "last_30d" }));
      await GET(requestWith({ adAccountId: "act_cache_4b", datePreset: "last_30d" }));

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // TENANT-SCOPING FIX (Phase T2): the real regression test for this phase's own cache-key fix
    // — two different tenants requesting the identical `adAccountId`/`datePreset` must NOT share
    // a cached response.
    it("caches distinct tenants' identical adAccountId/datePreset combinations independently (real tenant-scoping regression test)", async () => {
      const fetchMock = vi.fn(
        async () => new Response(JSON.stringify(AD_ACCOUNT_RESPONSE), { status: 200 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const params = { adAccountId: "act_cache_tenant", datePreset: "last_30d" };
      resolveRouteSession.mockResolvedValue(SESSION);
      await GET(requestWith(params));
      resolveRouteSession.mockResolvedValue({ ...SESSION, tenantId: "other-tenant" });
      await GET(requestWith(params));

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
