import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET, POST } from "@/app/api/settings/waba/route";
import { DELETE, PUT } from "@/app/api/settings/waba/[id]/route";
import { POST as testWaba } from "@/app/api/settings/waba/[id]/test/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

describe("GET/POST /api/settings/waba", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(jsonRequest());
    expect(response.status).toBe(401);
  });

  it("GET proxies to aaos-api's GET /api/v1/settings/waba and wraps the array as { wabaConfigs }", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify([{ id: "waba-1" }]), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await GET(jsonRequest());
    const body = (await response.json()) as { wabaConfigs: unknown[] };
    expect(body.wabaConfigs).toHaveLength(1);
  });

  it("POST proxies the body to aaos-api's POST /api/v1/settings/waba", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "waba-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST(
      jsonRequest({
        branchId: "BINTARO",
        phoneNumber: "+1",
        wabaId: "w",
        phoneNumberId: "p",
        accessToken: "t",
      }),
    );
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/waba");
  });
});

describe("PUT/DELETE /api/settings/waba/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("PUT proxies to aaos-api's PUT /api/v1/settings/waba/:id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "waba-1", status: "INACTIVE" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT(jsonRequest({ status: "INACTIVE" }), { params: { id: "waba-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/waba/waba-1");
  });

  it("DELETE proxies to aaos-api's DELETE /api/v1/settings/waba/:id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await DELETE(jsonRequest(), { params: { id: "waba-1" } });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/waba/waba-1");
    expect(init?.method).toBe("DELETE");
  });
});

describe("POST /api/settings/waba/:id/test", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's POST /api/v1/settings/waba/:id/test", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true, message: "Terhubung" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await testWaba(jsonRequest(), { params: { id: "waba-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/waba/waba-1/test");
  });
});
