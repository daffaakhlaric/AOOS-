import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/closings/route";

function requestWith(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/closings");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function postRequestWith(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/closings", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("201 created", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ id: "closing-1" }), { status: 201 }),
    ) as unknown as typeof fetch;
    const response = await POST(
      postRequestWith({ leadId: "lead-1", salesHumanId: "sales-rina", closingType: "SPK" }),
    );
    expect(response.status).toBe(201);
  });

  it("returns the upstream error status when aaos-api fails", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 422 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequestWith({ leadId: "lead-1" }));
    expect(response.status).toBe(422);
  });
});

describe("GET /api/closings", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sales own closings", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify([{ id: "closing-1" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(requestWith({ salesHumanId: "sales-rina" }));
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.searchParams.get("salesHumanId")).toBe("sales-rina");
    const body = (await response.json()) as { closings: unknown[] };
    expect(body.closings).toHaveLength(1);
  });

  it("returns 400 when salesHumanId is missing", async () => {
    const response = await GET(requestWith());
    expect(response.status).toBe(400);
  });
});
