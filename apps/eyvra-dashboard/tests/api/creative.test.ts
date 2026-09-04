import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as detailGet } from "@/app/api/creative/[id]/route";
import { POST as approvePost } from "@/app/api/creative/[id]/approve/route";
import { POST as generatePost } from "@/app/api/creative/[id]/generate/route";
import { POST as rejectPost } from "@/app/api/creative/[id]/reject/route";
import { GET as logsGet } from "@/app/api/creative/logs/route";
import { GET, POST } from "@/app/api/creative/route";

function postRequest(body: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
    url: "http://localhost/api/creative",
  } as unknown as NextRequest;
}

function getRequest(url: string): NextRequest {
  return { url } as unknown as NextRequest;
}

function setEnv(): void {
  process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
  process.env["AAOS_API_KEY"] = "test-key";
}

describe("GET /api/creative", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns { packages } proxied from aaos-api", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify([{ id: "pkg-1", status: "PENDING" }]), { status: 200 }),
    ) as unknown as typeof fetch;

    const response = await GET(getRequest("http://localhost/api/creative"));
    const body = (await response.json()) as { packages: unknown[] };
    expect(body.packages).toHaveLength(1);
  });

  it("forwards the status/limit filters", async () => {
    const fetchMock = vi.fn(async (_url: URL) => new Response("[]", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await GET(getRequest("http://localhost/api/creative?status=PENDING&limit=25"));
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.searchParams.get("status")).toBe("PENDING");
    expect(url.searchParams.get("limit")).toBe("25");
  });

  it("returns the upstream error status on failure", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 500 }),
    ) as unknown as typeof fetch;
    const response = await GET(getRequest("http://localhost/api/creative"));
    expect(response.status).toBe(500);
  });
});

describe("POST /api/creative", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies a manual brief to aaos-api's create endpoint", async () => {
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "pkg-1", status: "DRAFT" }), { status: 201 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(postRequest({ unit: "xpander-001", generate: false }));
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init).toBeDefined();
    expect(url.pathname).toBe("/api/v1/creative-packages");
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("xpander-001");
  });

  it("returns the upstream validation error status", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "invalid angle" }), { status: 422 }),
    ) as unknown as typeof fetch;
    const response = await POST(postRequest({ angle: "PROMO" }));
    expect(response.status).toBe(422);
  });
});

describe("GET /api/creative/logs", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's real creative_logs endpoint, forwarding the filters", async () => {
    const fetchMock = vi.fn(async (_url: URL) => new Response("[]", { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await logsGet(
      getRequest("http://localhost/api/creative/logs?eventType=GENERATE&sinceHours=24"),
    );
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/logs");
    expect(url.searchParams.get("eventType")).toBe("GENERATE");
    expect(url.searchParams.get("sinceHours")).toBe("24");
  });

  it("returns the upstream error status", async () => {
    global.fetch = vi.fn(
      async () => new Response("{}", { status: 503 }),
    ) as unknown as typeof fetch;
    const response = await logsGet(getRequest("http://localhost/api/creative/logs"));
    expect(response.status).toBe(503);
  });
});

describe("GET /api/creative/:id", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to the REAL single-item endpoint (no client-side list scan)", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ package: { id: "pkg-1" }, logs: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await detailGet(new Request("http://localhost"), {
      params: { id: "pkg-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/pkg-1");
  });

  it("passes a 404 straight through", async () => {
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ message: "not found" }), { status: 404 }),
    ) as unknown as typeof fetch;
    const response = await detailGet(new Request("http://localhost"), {
      params: { id: "missing" },
    });
    expect(response.status).toBe(404);
  });
});

describe("POST /api/creative/:id/generate", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's generate endpoint (the only real Kie AI spend path)", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ id: "pkg-1", status: "GENERATING" }), { status: 202 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await generatePost(new Request("http://localhost"), {
      params: { id: "pkg-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/pkg-1/generate");
  });

  it("passes an upstream 503 (Kai not configured) through honestly", async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Kai is not configured" }), { status: 503 }),
    ) as unknown as typeof fetch;
    const response = await generatePost(new Request("http://localhost"), {
      params: { id: "pkg-1" },
    });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toContain("not configured");
  });
});

describe("POST /api/creative/:id/approve", () => {
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's approve endpoint with the package id in the URL", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ id: "pkg-1", status: "APPROVED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await approvePost(postRequest({ selectedCopyVariantId: "v-a" }), {
      params: { id: "pkg-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/pkg-1/approve");
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
  beforeEach(setEnv);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies to aaos-api's reject endpoint with the package id in the URL", async () => {
    const fetchMock = vi.fn(
      async (_url: URL) =>
        new Response(JSON.stringify({ id: "pkg-1", status: "REJECTED" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await rejectPost(postRequest({ reason: "off-brand" }), {
      params: { id: "pkg-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/creative-packages/pkg-1/reject");
  });
});
