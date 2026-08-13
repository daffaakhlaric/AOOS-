import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/leads/[leadId]/claim/route";

function requestWithBody(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

describe("POST /api/leads/:leadId/claim", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("200 with the updated (ASSIGNED) lead", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "lead-1", status: "ASSIGNED" }), { status: 200 }),
    ) as unknown as typeof fetch;
    const response = await POST(requestWithBody({ salesHumanId: "sales-rina" }), {
      params: { leadId: "lead-1" },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ASSIGNED");
  });

  it("already claimed → 409 conflict", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "already assigned" }), { status: 409 }),
    ) as unknown as typeof fetch;
    const response = await POST(requestWithBody({ salesHumanId: "sales-rina" }), {
      params: { leadId: "lead-1" },
    });
    expect(response.status).toBe(409);
  });

  it("sends salesHumanId in the proxied request body", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "lead-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    await POST(requestWithBody({ salesHumanId: "sales-rina" }), { params: { leadId: "lead-1" } });
    const [, options] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ salesHumanId: "sales-rina" });
  });
});
