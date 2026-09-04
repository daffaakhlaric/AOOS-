import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as GET_COMPETITORS, POST as POST_COMPETITOR } from "@/app/api/competitors/route";
import { DELETE as DELETE_COMPETITOR } from "@/app/api/competitors/[id]/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("/api/competitors", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("GET / proxies aaos-api's real GET /api/v1/competitors", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe("/api/v1/competitors");
      return new Response(
        JSON.stringify([
          {
            id: "c-1",
            name: "Suzuki Bintaro",
            pageId: "111",
            vertical: "AUTOMOTIVE",
            active: true,
            createdAt: "2026-08-01T00:00:00.000Z",
          },
        ]),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET_COMPETITORS();
    const body = (await response.json()) as { competitors: readonly { id: string }[] };
    expect(body.competitors).toHaveLength(1);
    expect(body.competitors[0]?.id).toBe("c-1");
  });

  it("POST / forwards the create body and returns 201", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/competitors");
      const parsed = JSON.parse(init?.body as string) as { name: string; pageId: string };
      expect(parsed.name).toBe("Suzuki Bintaro");
      expect(parsed.pageId).toBe("111");
      return new Response(
        JSON.stringify({
          id: "c-1",
          name: "Suzuki Bintaro",
          pageId: "111",
          vertical: "AUTOMOTIVE",
          active: true,
          createdAt: "2026-08-01T00:00:00.000Z",
        }),
        { status: 201 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST_COMPETITOR(
      postRequest({ name: "Suzuki Bintaro", pageId: "111", vertical: "AUTOMOTIVE", active: true }),
    );
    expect(response.status).toBe(201);
  });

  it("DELETE /:id forwards to the real delete endpoint", async () => {
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      expect(url.pathname).toBe("/api/v1/competitors/c-1");
      expect(init?.method).toBe("DELETE");
      return new Response(null, { status: 204 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await DELETE_COMPETITOR(postRequest(undefined), { params: { id: "c-1" } });
    expect(response.status).toBe(204);
  });

  it("GET / returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET_COMPETITORS();
    expect(response.status).toBe(500);
  });
});
