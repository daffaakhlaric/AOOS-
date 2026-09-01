import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/clara/analytics/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/clara/analytics");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/clara/analytics", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    resolveRouteSession.mockResolvedValue(SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(requestWith({ days: "7" }));
    expect(response.status).toBe(401);
  });

  it("proxies aaos-api's real GET /api/v1/leads/analytics with the days query param", async () => {
    const fetchMock = vi.fn(async (input: URL) => {
      expect(input.searchParams.get("days")).toBe("7");
      return new Response(
        JSON.stringify({
          periodDays: 7,
          totalContacts: 3,
          newContacts: 1,
          active: 2,
          avgResponseTimeMinutes: 12.5,
          avgFirstResponseTimeMinutes: 8,
          dailySeries: [],
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith({ days: "7" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { totalContacts: number };
    expect(body.totalContacts).toBe(3);
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(requestWith());
    expect(response.status).toBe(500);
  });

  it("PROPERTY-TENANT-ISOLATION Phase 1: forwards x-tenant-id: session.tenantId to aaos-api (same convention modules/settings's proxy routes already use)", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            periodDays: 7,
            totalContacts: 0,
            newContacts: 0,
            active: 0,
            avgResponseTimeMinutes: null,
            avgFirstResponseTimeMinutes: null,
            dailySeries: [],
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await GET(requestWith({ days: "7" }));
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["x-tenant-id"]).toBe("dss-motor");
  });
});
