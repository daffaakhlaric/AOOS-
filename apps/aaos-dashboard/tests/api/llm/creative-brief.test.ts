import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/llm/creative-brief/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/llm/creative-brief", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's POST /api/v1/llm/creative-brief, passing the body straight through", async () => {
    const upstreamBody = {
      unit: "Xpander Cross 2019",
      angle: "DP_RINGAN",
      branch: "CINERE",
      primaryMessage: "DP mulai 29 juta",
      tone: "casual, relatable",
      formats: ["VIDEO_15S", "IMAGE_SQUARE"],
      avoid: ["klaim berlebihan"],
      urgency: "HIGH",
      reason: "frequency tinggi, perlu refresh",
    };
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify(upstreamBody), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = { ad: { id: "ad-1" }, angle: "DP_RINGAN", branch: "CINERE" };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamBody);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/llm/creative-brief");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("returns a uniform { error } envelope with the upstream status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "invalid angle" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ ad: {}, angle: "BOGUS", branch: "UMUM" }));
    expect(response.status).toBe(422);
  });

  it("returns 502 when the upstream call throws", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ ad: {}, angle: "DP_RINGAN", branch: "UMUM" }));
    expect(response.status).toBe(502);
  });
});
