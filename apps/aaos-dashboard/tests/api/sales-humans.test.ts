import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/sales-humans/route";
import { PUT } from "@/app/api/sales-humans/[id]/route";
import { POST as resetPassword } from "@/app/api/sales-humans/[id]/reset-password/route";

function getRequest(searchParams: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/sales-humans");
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

function postRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("GET /api/sales-humans", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies branchId to aaos-api and returns { salesHumans }", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify([{ id: "sh-1", name: "Ahmad" }]), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(getRequest({ branchId: "BINTARO" }));
    const body = (await response.json()) as { salesHumans: unknown[] };
    expect(body.salesHumans).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.searchParams.get("branchId")).toBe("BINTARO");
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(getRequest());
    expect(response.status).toBe(500);
  });
});

describe("POST /api/sales-humans", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies the body to aaos-api's POST /api/v1/sales-humans", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "sh-1", name: "Ahmad" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const body = {
      name: "Ahmad",
      email: "a@mobix.id",
      password: "password123",
      branchId: "BINTARO",
    };
    const response = await POST(postRequest(body));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/sales-humans");
    expect(init?.method).toBe("POST");
  });

  it("returns the upstream error status (e.g. 409 duplicate email)", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "sudah terdaftar" }), { status: 409 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequest({}));
    expect(response.status).toBe(409);
  });
});

describe("PUT /api/sales-humans/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's PUT /api/v1/sales-humans/:id", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "sh-1", status: "OFF" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await PUT(postRequest({ status: "OFF" }), { params: { id: "sh-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/sales-humans/sh-1");
  });
});

describe("POST /api/sales-humans/:id/reset-password", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's POST /api/v1/sales-humans/:id/reset-password", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "sh-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await resetPassword(postRequest({ password: "newpassword123" }), {
      params: { id: "sh-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/sales-humans/sh-1/reset-password");
  });
});
