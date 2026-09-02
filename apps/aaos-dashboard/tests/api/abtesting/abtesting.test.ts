import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET as GET_TESTS, POST as POST_TEST } from "@/app/api/abtesting/route";
import { GET as GET_TEST } from "@/app/api/abtesting/[id]/route";
import { POST as POST_PAUSE } from "@/app/api/abtesting/[id]/pause/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/abtesting");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function fetchMockReturning(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn(async () => response);
}

describe("/api/abtesting", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    resolveRouteSession.mockResolvedValue(SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // TENANT-SCOPING FIX (Phase T2): every handler in this file now resolves the real session and
  // forwards `x-tenant-id` — 401s with no session, same as every other proxy route in this app.
  it("GET / returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET_TESTS(requestWith());
    expect(response.status).toBe(401);
  });

  it("GET / proxies aaos-api's real GET /api/v1/abtesting with the real per-request tenant id", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify([{ id: "test-1", status: "RUNNING", variants: [] }]), {
        status: 200,
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_TESTS(requestWith());
    const body = (await response.json()) as { tests: unknown[] };
    expect(body.tests).toHaveLength(1);
  });

  it("GET / forwards the status query param", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.searchParams.get("status")).toBe("RUNNING");
      return new Response(JSON.stringify([]), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await GET_TESTS(requestWith({ status: "RUNNING" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("GET / returns the upstream error status on failure", async () => {
    global.fetch = fetchMockReturning(
      new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET_TESTS(requestWith());
    expect(response.status).toBe(500);
  });

  it("POST / forwards the create body, the real per-request tenant id, and returns 201", async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) => {
      const parsed = JSON.parse(init?.body as string) as { name: string };
      expect(parsed.name).toBe("Xpander Cinere — DP vs Stok");
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify({ id: "test-1", status: "DRAFT", variants: [] }), {
        status: 201,
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_TEST(
      postRequest({ name: "Xpander Cinere — DP vs Stok", campaignId: "camp-1" }),
    );
    expect(response.status).toBe(201);
  });

  it("GET /:id proxies the real single-test lookup with the real per-request tenant id", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/abtesting/test-1");
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify({ id: "test-1", status: "RUNNING", variants: [] }), {
        status: 200,
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_TEST(postRequest(undefined), { params: { id: "test-1" } });
    const body = (await response.json()) as { test: { id: string } };
    expect(body.test.id).toBe("test-1");
  });

  it("POST /:id/pause forwards to the real pause endpoint with the real per-request tenant id", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/abtesting/test-1/pause");
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("dss-motor");
      return new Response(JSON.stringify({ id: "test-1", status: "PAUSED", variants: [] }), {
        status: 200,
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_PAUSE(postRequest(undefined), { params: { id: "test-1" } });
    const body = (await response.json()) as { test: { status: string } };
    expect(body.test.status).toBe("PAUSED");
  });
});
