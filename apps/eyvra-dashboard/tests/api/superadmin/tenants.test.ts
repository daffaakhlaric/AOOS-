import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET, POST } from "@/app/api/superadmin/tenants/route";
import { PUT } from "@/app/api/superadmin/tenants/[id]/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

const SUPERADMIN_SESSION = {
  userId: "s1",
  email: "superadmin@aaos.id",
  role: "superadmin",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

describe("GET /api/superadmin/tenants", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 403 when the session is not superadmin", async () => {
    resolveRouteSession.mockResolvedValue({ ...SUPERADMIN_SESSION, role: "manager" });
    const response = await GET(jsonRequest());
    expect(response.status).toBe(403);
  });

  it("proxies to aaos-api's GET /api/v1/superadmin/tenants for a real superadmin session", async () => {
    resolveRouteSession.mockResolvedValue(SUPERADMIN_SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({ kpi: { totalTenants: 1 }, tenants: [{ tenantId: "dss-motor" }] }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(jsonRequest());
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/superadmin/tenants");
  });
});

describe("POST /api/superadmin/tenants", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 403 when the session is not superadmin", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(403);
  });

  it("proxies the body to aaos-api's POST /api/v1/superadmin/tenants", async () => {
    resolveRouteSession.mockResolvedValue(SUPERADMIN_SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ tenantId: "new-tenant" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST(jsonRequest({ tenantId: "new-tenant" }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/superadmin/tenants");
    expect(init?.method).toBe("POST");
  });
});

describe("PUT /api/superadmin/tenants/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's PUT /api/v1/superadmin/tenants/:id", async () => {
    resolveRouteSession.mockResolvedValue(SUPERADMIN_SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ tenantId: "dss-motor", status: "SUSPENDED" }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT(jsonRequest({ status: "SUSPENDED" }), {
      params: { id: "dss-motor" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/superadmin/tenants/dss-motor");
  });
});
