import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PUT } from "@/app/api/sales-humans/[id]/route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const SALES_HUMAN = {
  id: "sh-1",
  name: "Ahmad",
  email: "ahmad@mobix.id",
  phone: "+62812000001",
  branchId: "BINTARO",
  status: "ON",
  maxLeadsPerDay: 10,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSignInAt: undefined,
};

describe("GET /api/sales-humans/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("finds the matching sales human from the full list", async () => {
    global.fetch = vi.fn(async () => jsonResponse([SALES_HUMAN])) as unknown as typeof fetch;
    const response = await GET(new Request("http://localhost/api/sales-humans/sh-1") as never, {
      params: { id: "sh-1" },
    });
    const body = (await response.json()) as { id: string };
    expect(body.id).toBe("sh-1");
  });

  it("returns 404 when not found", async () => {
    global.fetch = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    const response = await GET(new Request("http://localhost/api/sales-humans/missing") as never, {
      params: { id: "missing" },
    });
    expect(response.status).toBe(404);
  });
});

describe("PUT /api/sales-humans/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's PUT /api/v1/sales-humans/:id", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(SALES_HUMAN));
    global.fetch = fetchMock as unknown as typeof fetch;
    const request = { json: () => Promise.resolve({ name: "Ahmad Baru" }) } as unknown as never;
    const response = await PUT(request, { params: { id: "sh-1" } });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/api/v1/sales-humans/sh-1");
    expect(init.method).toBe("PUT");
  });
});
