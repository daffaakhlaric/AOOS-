import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/llm/chat/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/llm/chat", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's POST /api/v1/llm/chat, passing the body straight through", async () => {
    const upstreamBody = { reply: "Bandung mahal karena CPM tinggi minggu ini." };
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify(upstreamBody), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = {
      messages: [{ role: "user", content: "Kenapa Bandung mahal?" }],
      context: "campaign summary",
    };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamBody);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/llm/chat");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("returns a uniform { error } envelope with the upstream status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ messages: [], context: "" }));
    expect(response.status).toBe(429);
  });

  it("returns 502 when the upstream call throws", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ messages: [], context: "" }));
    expect(response.status).toBe(502);
  });
});
