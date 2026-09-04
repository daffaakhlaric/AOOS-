import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/settings/route";

function buildRequest(): NextRequest {
  return {} as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET /api/settings", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when there is no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it("forwards x-tenant-id: session.tenantId to aaos-api (coordinator note section 2's real per-request tenant header)", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            tenant: {
              tenantId: "propertyklik-demo",
              name: "PropertyKlik",
              vertical: "PROPERTY",
              status: "ACTIVE",
            },
            meta: { apiVersion: "v21.0", hasToken: false, usingEnvDefault: true },
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-tenant-id"]).toBe("propertyklik-demo");
  });
});
