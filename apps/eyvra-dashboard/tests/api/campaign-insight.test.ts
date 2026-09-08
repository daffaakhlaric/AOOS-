import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/campaign-insight/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

const VALID_BODY = {
  campaignId: "camp-1",
  campaignName: "Xpander Bintaro",
  verdict: "SCALE",
  spend: 2_500_000,
  totalLead: 12,
  clicks: 340,
  impressions: 15_000,
  maxFrequency: 2.1,
  adCount: 4,
  adSetCount: 2,
  cpl: 208_333,
  benchmarkCplIDR: 250_000,
};

describe("POST /api/campaign-insight", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await POST(postRequest(VALID_BODY));
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's POST /api/v1/campaigns/insight with the real per-request tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify({ available: true, narrative: "OK", actions: [] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest(VALID_BODY));
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/campaigns/insight");
    expect(init.body).toBe(JSON.stringify(VALID_BODY));
    expect((init.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
  });

  it("returns the upstream error status on failure", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "invalid body" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({}));
    expect(response.status).toBe(422);
  });
});
