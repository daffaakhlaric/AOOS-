import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/verdicts/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/verdicts", () => {
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
    const response = await POST(postRequest({ verdict: "PAUSE" }));
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's POST /api/v1/verdicts with the real per-request tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify({ action: "PAUSED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = { verdict: "PAUSE", targetId: "ad-1", targetType: "ad" };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/verdicts");
    expect(init.body).toBe(JSON.stringify(body));
    expect((init.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
  });

  it("returns the upstream error status on failure", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "invalid verdict" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ verdict: "NOT_A_VERDICT" }));
    expect(response.status).toBe(422);
  });
});
