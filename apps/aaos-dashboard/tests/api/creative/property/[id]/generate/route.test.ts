import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/creative/property/[id]/generate/route";

function postRequest(): NextRequest {
  return {
    url: "http://localhost/api/creative/property/pkg-1/generate",
    json: async () => ({}),
  } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("POST /api/creative/property/:id/generate", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await POST(postRequest(), { params: { id: "pkg-1" } });
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's POST /api/v1/creative-packages/property/:id/generate, forwarding the caller's tenant id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pkg-1", status: "GENERATING" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest(), { params: { id: "pkg-1" } });
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/creative-packages/property/pkg-1/generate");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({ "x-tenant-id": "propertyklik-demo" });
  });

  it("URL-encodes the package id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pkg/1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await POST(postRequest(), { params: { id: "pkg/1" } });
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/creative-packages/property/pkg%2F1/generate");
  });

  it("returns 500 on an unexpected error", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const response = await POST(postRequest(), { params: { id: "pkg-1" } });
    expect(response.status).toBe(500);
  });
});
