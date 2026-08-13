import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/creative/route";
import { POST as approvePost } from "@/app/api/creative/[id]/approve/route";
import { POST as rejectPost } from "@/app/api/creative/[id]/reject/route";

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("GET /api/creative", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { packages } proxied from aaos-api", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: "KAI-001", status: "PENDING" }]), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET();
    const body = (await response.json()) as { packages: unknown[] };
    expect(body.packages).toHaveLength(1);
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/creative/:id/approve", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's approve endpoint with the package id in the URL", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ id: "KAI-001", status: "APPROVED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await approvePost(postRequest({ selectedCopyVariantId: "v-a" }), {
      params: { id: "KAI-001" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/KAI-001/approve");
  });

  it("returns the upstream error status", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await approvePost(postRequest({}), { params: { id: "missing" } });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/creative/:id/reject", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's reject endpoint with the package id in the URL", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ id: "KAI-001", status: "REJECTED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await rejectPost(postRequest({ reason: "off-brand" }), {
      params: { id: "KAI-001" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/KAI-001/reject");
  });
});
