import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/leads/[leadId]/route";

describe("GET /api/leads/:leadId", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's GET /api/v1/leads/:id", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "lead-1", messages: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(new Request("http://localhost/api/leads/lead-1"), {
      params: { leadId: "lead-1" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toBe("/api/v1/leads/lead-1");
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe("lead-1");
  });

  it("returns the upstream 404 when the lead does not exist", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    ) as unknown as typeof fetch;
    const response = await GET(new Request("http://localhost/api/leads/missing"), {
      params: { leadId: "missing" },
    });
    expect(response.status).toBe(404);
  });
});
