import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/creative/property/route";

function postRequest(body: unknown): NextRequest {
  return {
    url: "http://localhost/api/creative/property",
    json: async () => body,
  } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("POST /api/creative/property", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await POST(postRequest({}));
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's POST /api/v1/creative-packages/property, forwarding the caller's tenant id and the real body verbatim", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pkg-1", vertical: "PROPERTY" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = {
      listingId: "listing-1",
      angle: "READY_HUNI",
      format: "VIDEO_AND_IMAGES",
      urgency: "MEDIUM",
      origin: "MANUAL",
      generate: false,
    };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/creative-packages/property");
    expect((init as RequestInit).headers).toMatchObject({ "x-tenant-id": "propertyklik-demo" });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject(body);
  });

  it("returns the real upstream error status/message instead of a generic one", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "listingId: not found" }), { status: 404 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequest({ listingId: "missing" }));
    expect(response.status).toBe(404);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error.message).toBe("listingId: not found");
  });

  it("returns 500 on an unexpected error", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const response = await POST(postRequest({}));
    expect(response.status).toBe(500);
  });
});
