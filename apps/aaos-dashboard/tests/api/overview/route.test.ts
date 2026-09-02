import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/overview/route";

function getRequest(url = "http://localhost/api/overview"): NextRequest {
  return { url } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET /api/overview", () => {
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

  it("proxies to aaos-api's GET /api/v1/overview with the caller's tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const body = {
      tenantId: "propertyklik-demo",
      generatedAt: new Date().toISOString(),
      agentStatus: [],
      activities: [],
      insight: { available: false, reason: "NO_API_KEY", message: "unavailable" },
      errors: {},
    };
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(getRequest());
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/overview");
    expect((init as RequestInit).headers).toMatchObject({ "x-tenant-id": "propertyklik-demo" });
    expect(await response.json()).toEqual(body);
  });

  it("returns the upstream error status/message on a non-2xx aaos-api response", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "boom" }), { status: 503 }),
    ) as unknown as typeof fetch;
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
    expect((await response.json()) as { error: { message: string } }).toEqual({
      error: { message: "boom" },
    });
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
