import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/branches/route";
import { PUT } from "@/app/api/branches/[id]/route";

function putRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("GET /api/branches", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { branches } proxied from aaos-api", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: "BINTARO" }, { id: "CINERE" }]), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    const body = (await response.json()) as { branches: unknown[] };
    expect(body.branches).toHaveLength(2);
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("PUT /api/branches/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies the body to aaos-api's PUT /api/v1/branches/:id", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify({ id: "BINTARO", assignmentMode: "ROUND_ROBIN" }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = { assignmentMode: "ROUND_ROBIN" };
    const response = await PUT(putRequest(body), { params: { id: "BINTARO" } });
    expect(response.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/branches/BINTARO");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("returns the upstream error status on validation failure", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "Unknown branchId" }), { status: 422 }),
    ) as unknown as typeof fetch;

    const response = await PUT(putRequest({}), { params: { id: "NOT_A_BRANCH" } });
    expect(response.status).toBe(422);
  });
});
