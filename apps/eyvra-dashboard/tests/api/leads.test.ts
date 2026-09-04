import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET } from "@/app/api/leads/route";

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/leads");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/leads", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
    resolveRouteSession.mockResolvedValue(SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(requestWith({ branchId: "BINTARO" }));
    expect(response.status).toBe(401);
  });

  it("proxies a single branch when branchId is given", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ id: "lead-1" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith({ branchId: "BINTARO" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { leads: unknown[] };
    expect(body.leads).toHaveLength(1);
  });

  it("fans out across all 4 DSS Motor branches when no branchId is given", async () => {
    const fetchMock = vi.fn(async (input: URL) => {
      const branchId = input.searchParams.get("branchId");
      return new Response(JSON.stringify([{ id: `lead-${branchId}` }]), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith());
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const body = (await response.json()) as { leads: readonly { id: string }[] };
    expect(body.leads).toHaveLength(4);
    expect(body.leads.map((lead) => lead.id).sort()).toEqual([
      "lead-BANDUNG",
      "lead-BINTARO",
      "lead-CINERE",
      "lead-UMUM",
    ]);
  });

  it("returns the upstream error status when any branch call fails", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(requestWith({ branchId: "BINTARO" }));
    expect(response.status).toBe(500);
  });

  it("PROPERTY-TENANT-ISOLATION Phase 1: forwards x-tenant-id: session.tenantId to aaos-api (same convention modules/settings's proxy routes already use)", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify([{ id: "lead-1" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await GET(requestWith({ branchId: "BINTARO" }));
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit)?.headers as Record<string, string>;
    expect(headers["x-tenant-id"]).toBe("dss-motor");
  });
});
