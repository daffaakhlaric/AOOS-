import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leads/my/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/leads/my");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/leads/my", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api with salesHumanId", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ id: "lead-1" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(requestWith({ salesHumanId: "sales-rina" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { leads: unknown[] };
    expect(body.leads).toHaveLength(1);
  });

  it("returns 400 when salesHumanId is missing", async () => {
    const response = await GET(requestWith());
    expect(response.status).toBe(400);
  });
});
