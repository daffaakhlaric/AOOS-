import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/meta-ads-accounts/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function requestFor(): NextRequest {
  return { nextUrl: new URL("http://localhost/api/meta-ads-accounts") } as unknown as NextRequest;
}

describe("GET /api/meta-ads-accounts", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TENANT-SCOPING FIX (Phase T2): this route now resolves the real session and forwards
  // `x-tenant-id` — 401s with no session, same as every other proxy route in this app.
  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(requestFor());
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's GET /api/v1/meta-ads/accounts with the real per-request tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const body = [
      { id: "act_1", name: "DSS Motor" },
      { id: "act_2", name: "Pusat Grosir Mobil" },
    ];
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/meta-ads/accounts");
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify(body), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestFor());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns the upstream error status on failure", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "aaos-api unreachable" }), { status: 503 }),
    ) as unknown as typeof fetch;

    const response = await GET(requestFor());
    expect(response.status).toBe(503);
  });
});
