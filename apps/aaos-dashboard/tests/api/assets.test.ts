import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getList } from "@/app/api/assets/route";
import { DELETE as deleteAsset, GET as getById } from "@/app/api/assets/[id]/route";
import { GET as getDownload } from "@/app/api/assets/[id]/download/route";
import { GET as getStats } from "@/app/api/assets/stats/route";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("assets proxy routes", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/assets", () => {
    it("proxies GET /api/v1/assets with the server-only x-api-key", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ assets: [{ id: "asset-1" }], total: 1, page: 1, limit: 48 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await getList(new Request("http://localhost/api/assets") as never);
      expect(response.status).toBe(200);
      const body = (await response.json()) as { total: number };
      expect(body.total).toBe(1);

      const [url, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect(url.pathname).toBe("/api/v1/assets");
      expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    });

    it("forwards every supplied filter and omits the rest", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ assets: [], total: 0, page: 1, limit: 48 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await getList(
        new Request(
          "http://localhost/api/assets?type=AI_VIDEO&branch=CINERE&unitId=brio-a&search=depan&page=2&limit=12&sort=oldest",
        ) as never,
      );

      const [url] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(url.searchParams.get("type")).toBe("AI_VIDEO");
      expect(url.searchParams.get("branch")).toBe("CINERE");
      expect(url.searchParams.get("unitId")).toBe("brio-a");
      expect(url.searchParams.get("search")).toBe("depan");
      expect(url.searchParams.get("page")).toBe("2");
      expect(url.searchParams.get("limit")).toBe("12");
      expect(url.searchParams.get("sort")).toBe("oldest");
      expect(url.searchParams.has("status")).toBe(false);
    });

    it("sends NO type param for the 'Semua' tab (never an invented ALL value)", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ assets: [], total: 0, page: 1, limit: 48 }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await getList(new Request("http://localhost/api/assets?page=1&limit=48") as never);
      const [url] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(url.searchParams.has("type")).toBe(false);
    });

    it("passes through the upstream 503 when the asset library is not configured", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "Asset library is not configured on this deployment" }, 503),
      ) as unknown as typeof fetch;

      const response = await getList(new Request("http://localhost/api/assets") as never);
      expect(response.status).toBe(503);
      const body = (await response.json()) as { error: { message: string } };
      expect(body.error.message).toContain("not configured");
    });

    it("passes through an upstream 422 for a fabricated type", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "Request validation failed: type" }, 422),
      ) as unknown as typeof fetch;
      const response = await getList(new Request("http://localhost/api/assets?type=ALL") as never);
      expect(response.status).toBe(422);
    });
  });

  describe("GET /api/assets/stats", () => {
    it("proxies the aggregate counts", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({
          totalAssets: 412,
          byType: { UNIT_PHOTO: 312 },
          byBranch: {},
          byStatus: {},
          totalSizeBytes: 100,
        }),
      ) as unknown as typeof fetch;

      const response = await getStats();
      const body = (await response.json()) as { totalAssets: number };
      expect(body.totalAssets).toBe(412);
    });

    it("passes through an upstream failure", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "boom" }, 500),
      ) as unknown as typeof fetch;
      expect((await getStats()).status).toBe(500);
    });
  });

  describe("GET /api/assets/:id", () => {
    it("URL-encodes the id and returns the asset", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ id: "a/b" }));
      global.fetch = fetchMock as unknown as typeof fetch;

      await getById(new Request("http://localhost") as never, { params: { id: "a/b" } });
      const [url] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(String(url)).toBe("http://localhost:3000/api/v1/assets/a%2Fb");
    });

    it("passes through an upstream 404", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "Asset not found" }, 404),
      ) as unknown as typeof fetch;
      const response = await getById(new Request("http://localhost") as never, {
        params: { id: "nope" },
      });
      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/assets/:id — ARCHIVE, not a hard delete", () => {
    it("issues an upstream DELETE and returns the ARCHIVED asset (never { deleted: true })", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ id: "asset-1", status: "ARCHIVED" }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const response = await deleteAsset(new Request("http://localhost") as never, {
        params: { id: "asset-1" },
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as Record<string, unknown>;
      expect(body["status"]).toBe("ARCHIVED");
      expect(body).not.toHaveProperty("deleted");

      const [, init] = fetchMock.mock.calls[0]! as unknown as [URL, RequestInit];
      expect(init.method).toBe("DELETE");
    });

    it("passes through an upstream 404", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "Asset not found" }, 404),
      ) as unknown as typeof fetch;
      const response = await deleteAsset(new Request("http://localhost") as never, {
        params: { id: "nope" },
      });
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/assets/:id/download", () => {
    it("returns the real signed URL as JSON (not a redirect)", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({
          url: "https://storage.googleapis.com/aoos/x.jpg?X-Goog-Signature=abc",
          expiresInSeconds: 3600,
        }),
      ) as unknown as typeof fetch;

      const response = await getDownload(
        new Request("http://localhost/api/assets/asset-1/download") as never,
        { params: { id: "asset-1" } },
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { url: string; expiresInSeconds: number };
      expect(body.url).toContain("X-Goog-Signature");
      expect(body.expiresInSeconds).toBe(3600);
    });

    it("forwards an explicit expiresIn and omits it otherwise", async () => {
      const fetchMock = vi.fn(async () => jsonResponse({ url: "u", expiresInSeconds: 900 }));
      global.fetch = fetchMock as unknown as typeof fetch;

      await getDownload(
        new Request("http://localhost/api/assets/asset-1/download?expiresIn=900") as never,
        { params: { id: "asset-1" } },
      );
      const [withExpiry] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(withExpiry.searchParams.get("expiresIn")).toBe("900");

      fetchMock.mockClear();
      await getDownload(new Request("http://localhost/api/assets/asset-1/download") as never, {
        params: { id: "asset-1" },
      });
      const [withoutExpiry] = fetchMock.mock.calls[0]! as unknown as [URL];
      expect(withoutExpiry.searchParams.has("expiresIn")).toBe(false);
    });

    it("passes through a signing failure", async () => {
      global.fetch = vi.fn(async () =>
        jsonResponse({ message: "cannot sign without a private key" }, 500),
      ) as unknown as typeof fetch;
      const response = await getDownload(
        new Request("http://localhost/api/assets/asset-1/download") as never,
        { params: { id: "asset-1" } },
      );
      expect(response.status).toBe(500);
    });
  });
});
