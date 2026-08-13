import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/objective/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("GET /api/objective", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { objective } on success", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ id: "obj-1", status: "DRAFT" }), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { objective: { id: string } };
    expect(body.objective.id).toBe("obj-1");
  });

  it("returns { objective: null } with a 200 (not an error) when aaos-api returns 404", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { objective: null };
    expect(body.objective).toBeNull();
  });

  it("passes through a non-404 error status", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "server error" }), { status: 500 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/objective", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies the body to aaos-api and returns 201 with the created objective", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init: RequestInit) =>
        new Response(JSON.stringify({ id: "obj-2", status: "DRAFT" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = {
      targetHotLeads: 50,
      budgetAllocation: 30_000_000,
      focusUnits: ["Xpander"],
      areaPriorities: ["BINTARO"],
    };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(201);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toBe(JSON.stringify(body));
  });

  it("returns the upstream error status/message on validation failure", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "budgetAllocation must be positive" }), {
          status: 422,
        }),
    ) as unknown as typeof fetch;

    const response = await POST(postRequest({ targetHotLeads: 50 }));
    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/budgetAllocation/);
  });
});
