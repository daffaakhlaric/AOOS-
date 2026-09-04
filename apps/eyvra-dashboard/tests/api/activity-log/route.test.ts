import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/activity-log/route";

function getRequest(url = "http://localhost/api/activity-log"): NextRequest {
  return { url } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET /api/activity-log", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(getRequest());
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's GET /api/v1/activity-log with the caller's tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ activities: [], total: 0 }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/activity-log");
    expect((init as RequestInit).headers).toMatchObject({ "x-tenant-id": "propertyklik-demo" });
  });

  it("forwards agent/status/mode/limit filters as real query params", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ activities: [], total: 0 }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await GET(
      getRequest(
        "http://localhost/api/activity-log?agent=SAMANTHA&status=ERROR&mode=LIVE&limit=20",
      ),
    );
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).searchParams.get("agent")).toBe("SAMANTHA");
    expect((url as URL).searchParams.get("status")).toBe("ERROR");
    expect((url as URL).searchParams.get("mode")).toBe("LIVE");
    expect((url as URL).searchParams.get("limit")).toBe("20");
  });

  it("returns 500 on an unexpected error", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const response = await GET(getRequest());
    expect(response.status).toBe(500);
  });
});
