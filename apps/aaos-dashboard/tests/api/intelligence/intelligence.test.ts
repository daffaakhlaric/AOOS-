import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_SIGNALS } from "@/app/api/intelligence/signals/route";
import { POST as POST_REFRESH } from "@/app/api/intelligence/refresh/route";

function fetchMockReturning(response: Response): ReturnType<typeof vi.fn> {
  return vi.fn(async () => response);
}

describe("/api/intelligence", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET /signals proxies aaos-api's real GET /api/v1/intelligence/signals", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/intelligence/signals");
      return new Response(
        JSON.stringify({ id: "sig-1", generatedAt: "2026-08-24T06:00:00.000Z" }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_SIGNALS();
    const body = (await response.json()) as { signals: { id: string } };
    expect(body.signals.id).toBe("sig-1");
  });

  it("GET /signals returns the real 404 when no run has ever completed", async () => {
    global.fetch = fetchMockReturning(
      new Response(
        JSON.stringify({ message: "Belum ada Samantha Intelligence run untuk tenant ini." }),
        {
          status: 404,
        },
      ),
    ) as unknown as typeof fetch;
    const response = await GET_SIGNALS();
    expect(response.status).toBe(404);
  });

  it("POST /refresh proxies aaos-api's real POST /api/v1/intelligence/refresh", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/intelligence/refresh");
      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({ id: "sig-2", generatedAt: "2026-08-24T07:00:00.000Z" }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_REFRESH();
    const body = (await response.json()) as { signals: { id: string } };
    expect(body.signals.id).toBe("sig-2");
  });
});
