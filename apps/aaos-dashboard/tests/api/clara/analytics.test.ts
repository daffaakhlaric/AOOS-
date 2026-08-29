import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/clara/analytics/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/clara/analytics");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/clara/analytics", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies aaos-api's real GET /api/v1/leads/analytics with the days query param", async () => {
    const fetchMock = vi.fn(async (input: URL) => {
      expect(input.searchParams.get("days")).toBe("7");
      return new Response(
        JSON.stringify({
          periodDays: 7,
          totalContacts: 3,
          newContacts: 1,
          active: 2,
          avgResponseTimeMinutes: 12.5,
          avgFirstResponseTimeMinutes: 8,
          dailySeries: [],
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith({ days: "7" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { totalContacts: number };
    expect(body.totalContacts).toBe(3);
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(requestWith());
    expect(response.status).toBe(500);
  });
});
