import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "@/app/api/leads/[leadId]/status/route";

function requestWithBody(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe("PUT /api/leads/:leadId/status", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's PUT /api/v1/leads/:id/status", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "lead-1", status: "WARM" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT(requestWithBody({ status: "WARM" }), {
      params: { leadId: "lead-1" },
    });
    const [url, options] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/leads/lead-1/status");
    expect(JSON.parse(options.body as string)).toEqual({ status: "WARM" });
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("WARM");
  });

  it("returns the upstream error status when aaos-api rejects the transition", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 422 }),
    ) as unknown as typeof fetch;
    const response = await PUT(requestWithBody({ status: "ASSIGNED" }), {
      params: { leadId: "lead-1" },
    });
    expect(response.status).toBe(422);
  });
});
