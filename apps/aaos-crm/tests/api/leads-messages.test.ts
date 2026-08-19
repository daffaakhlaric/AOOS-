import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leads/[leadId]/messages/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/leads/lead-1/messages");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/leads/:leadId/messages", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies page/limit/order to aaos-api's GET /api/v1/leads/:id/messages", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ messages: [], page: 1, limit: 1, total: 0 }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(requestWith({ limit: "1", order: "desc" }), {
      params: { leadId: "lead-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toBe("/api/v1/leads/lead-1/messages");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(url.searchParams.get("order")).toBe("desc");
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(requestWith(), { params: { leadId: "lead-1" } });
    expect(response.status).toBe(500);
  });
});
