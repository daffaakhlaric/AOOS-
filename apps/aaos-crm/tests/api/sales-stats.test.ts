import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/sales/stats/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/sales/stats");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/sales/stats", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api and returns the stats payload", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            leadsToday: 3,
            testDriveThisMonth: 5,
            spkThisMonth: 2,
            commissionThisMonthIdr: 11_700_000,
            recentClosings: [],
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const response = await GET(requestWith({ salesHumanId: "sales-rina" }));
    const body = (await response.json()) as { leadsToday: number };
    expect(body.leadsToday).toBe(3);
  });

  it("returns 400 when salesHumanId is missing", async () => {
    const response = await GET(requestWith());
    expect(response.status).toBe(400);
  });
});
