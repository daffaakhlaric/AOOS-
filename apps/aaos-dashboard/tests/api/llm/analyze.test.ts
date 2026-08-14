import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/llm/analyze/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/llm/analyze", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's POST /api/v1/llm/analyze, passing the body straight through", async () => {
    const upstreamBody = {
      temuan: [{ icon: "🔴", judul: "Bandung mahal", detail: "Rp/lead tinggi" }],
      rekomendasi: [
        { aksi: "PAUSE", target: "#C001 Ad 1", alasan: "boros", estimasi: "hemat Rp 500rb" },
      ],
      ringkasan: "Kondisi iklan cukup baik secara umum.",
    };
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify(upstreamBody), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = { campaigns: [], totals: { spend: 0 } };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamBody);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/llm/analyze");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("returns a uniform { error } envelope with the upstream status on failure (e.g. no API key configured)", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "OPENAI_API_KEY not configured" }), {
          status: 503,
        }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ campaigns: [], totals: {} }));
    expect(response.status).toBe(503);
    const json = (await response.json()) as { error: { message: string } };
    expect(json.error.message).toContain("OPENAI_API_KEY");
  });

  it("returns 502 when the upstream call throws (network failure / endpoint not deployed yet)", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED");
    }) as unknown as typeof fetch;

    const response = await POST(postRequest({ campaigns: [], totals: {} }));
    expect(response.status).toBe(502);
  });
});
