import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/creative/photo-analysis/route";

function postRequest(body: unknown): NextRequest {
  return {
    url: "http://localhost/api/creative/photo-analysis",
    json: async () => body,
  } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("POST /api/creative/photo-analysis", () => {
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

  it("proxies to aaos-api's POST /api/v1/llm/photo-analysis, forwarding the caller's tenant id and the real body verbatim", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            available: true,
            scene: "EKSTERIOR",
            qualityScore: 80,
            marketingScore: 70,
            recommendedUse: "HERO",
            reasoning: "x",
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = { photoUrl: "https://gcs/listing-1/photo-1.jpg" };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/llm/photo-analysis");
    expect((init as RequestInit).headers).toMatchObject({ "x-tenant-id": "propertyklik-demo" });
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject(body);

    const json = (await response.json()) as { available: boolean };
    expect(json.available).toBe(true);
  });

  it("returns the real upstream error status/message instead of a generic one", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "photoUrl: invalid" }), { status: 400 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequest({ photoUrl: "not-a-url" }));
    expect(response.status).toBe(400);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error.message).toBe("photoUrl: invalid");
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
