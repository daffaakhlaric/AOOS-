import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET, POST } from "@/app/api/listings/route";
import { DELETE, GET as getOne, PUT } from "@/app/api/listings/[id]/route";
import { POST as uploadPhoto } from "@/app/api/listings/[id]/photos/route";
import { DELETE as deletePhoto } from "@/app/api/listings/[id]/photos/[photoId]/route";
import { PUT as reorderPhotos } from "@/app/api/listings/[id]/photos/reorder/route";
import { POST as publishKnowledge } from "@/app/api/listings/[id]/publish-knowledge/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return {
    json: () => Promise.resolve(body),
    url: "http://localhost/api/listings",
  } as unknown as NextRequest;
}

function formDataRequest(formData: FormData): NextRequest {
  return { formData: () => Promise.resolve(formData) } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET/POST /api/listings", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await GET(jsonRequest());
    expect(response.status).toBe(401);
  });

  it("GET proxies to aaos-api's GET /api/v1/listings", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ listings: [], total: 0 }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await GET(jsonRequest());
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings");
  });

  it("POST proxies the body to aaos-api's POST /api/v1/listings", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await POST(
      jsonRequest({ title: "Rumah Baru", propertyType: "RUMAH", price: 1_000_000_000 }),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings");
    expect((init?.headers as Record<string, string>)["x-tenant-id"]).toBe("propertyklik-demo");
  });
});

describe("GET/PUT/DELETE /api/listings/:id", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("GET proxies to aaos-api's GET /api/v1/listings/:id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1" }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await getOne(jsonRequest(), { params: { id: "listing-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1");
  });

  it("PUT proxies to aaos-api's PUT /api/v1/listings/:id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1", price: 2_000_000_000 }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PUT(jsonRequest({ price: 2_000_000_000 }), {
      params: { id: "listing-1" },
    });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1");
    expect(init?.method).toBe("PUT");
  });

  it("DELETE proxies to aaos-api's DELETE /api/v1/listings/:id", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await DELETE(jsonRequest(), { params: { id: "listing-1" } });
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBe("DELETE");
  });
});

describe("POST /api/listings/:id/photos", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await uploadPhoto(formDataRequest(new FormData()), {
      params: { id: "listing-1" },
    });
    expect(response.status).toBe(401);
  });

  it("forwards the multipart FormData body verbatim to aaos-api", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1", photos: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const formData = new FormData();
    formData.set("file", new Blob(["fake"], { type: "image/jpeg" }), "front.jpg");
    formData.set("label", "Tampak depan");
    const response = await uploadPhoto(formDataRequest(formData), {
      params: { id: "listing-1" },
    });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1/photos");
    expect(init?.body).toBe(formData);
    expect(init?.method).toBe("POST");
  });
});

describe("DELETE /api/listings/:id/photos/:photoId", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's DELETE /api/v1/listings/:id/photos/:photoId", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1", photos: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await deletePhoto(jsonRequest(), {
      params: { id: "listing-1", photoId: "photo-1" },
    });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1/photos/photo-1");
  });
});

describe("PUT /api/listings/:id/photos/reorder", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's PUT /api/v1/listings/:id/photos/reorder", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1", photos: [] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await reorderPhotos(jsonRequest({ photoIds: ["p2", "p1"] }), {
      params: { id: "listing-1" },
    });
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1/photos/reorder");
    expect(init?.method).toBe("PUT");
  });
});

describe("POST /api/listings/:id/publish-knowledge", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("proxies to aaos-api's POST /api/v1/listings/:id/publish-knowledge", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "listing-1", inKnowledgeBase: true }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await publishKnowledge(jsonRequest(), { params: { id: "listing-1" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/listings/listing-1/publish-knowledge");
  });
});
