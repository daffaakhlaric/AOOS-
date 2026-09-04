import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { PUT } from "@/app/api/settings/meta/route";
import { POST as testMeta } from "@/app/api/settings/meta/test/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

describe("PUT /api/settings/meta", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when there is no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await PUT(jsonRequest({ accessToken: "new-token" }));
    expect(response.status).toBe(401);
  });

  it("proxies the body to aaos-api's PUT /api/v1/settings/meta", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ meta: { hasToken: true } }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT(jsonRequest({ accessToken: "new-token" }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/meta");
    expect(init?.method).toBe("PUT");
  });
});

describe("POST /api/settings/meta/test", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's POST /api/v1/settings/meta/test", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true, message: "Terhubung" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await testMeta(jsonRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });
});
