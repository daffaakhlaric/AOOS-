import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { GET as getProvinces } from "@/app/api/region/provinces/route";
import { GET as getRegencies } from "@/app/api/region/regencies/[provinceId]/route";
import { GET as getDistricts } from "@/app/api/region/districts/[regencyId]/route";

function fakeRequest(): NextRequest {
  return { url: "http://localhost/api/region/provinces" } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  role: "manager",
  tenantId: "propertyklik-demo",
  vertical: "PROPERTY",
} as const;

describe("GET /api/region/provinces", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await getProvinces(fakeRequest());
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's real GET /api/v1/region/provinces", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [{ id: "11", nama: "Aceh" }] }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await getProvinces(fakeRequest());
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toEqual([{ id: "11", nama: "Aceh" }]);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/region/provinces");
  });

  it("real, honest degrade: an upstream failure surfaces a real error, not a fabricated list", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    global.fetch = vi.fn(
      async () => new Response(JSON.stringify({ error: { message: "boom" } }), { status: 503 }),
    ) as unknown as typeof fetch;
    const response = await getProvinces(fakeRequest());
    expect(response.status).toBe(503);
  });
});

describe("GET /api/region/regencies/:provinceId", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await getRegencies(fakeRequest(), { params: { provinceId: "11" } });
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's real GET /api/v1/region/regencies/:provinceId", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [{ id: "1101", nama: "Kabupaten Aceh Selatan" }] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await getRegencies(fakeRequest(), { params: { provinceId: "11" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/region/regencies/11");
  });
});

describe("GET /api/region/districts/:regencyId", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 with no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await getDistricts(fakeRequest(), { params: { regencyId: "1101" } });
    expect(response.status).toBe(401);
  });

  it("proxies to aaos-api's real GET /api/v1/region/districts/:regencyId", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [{ id: "110101", nama: "Bakongan" }] }), {
          status: 200,
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await getDistricts(fakeRequest(), { params: { regencyId: "1101" } });
    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0]!;
    expect((url as URL).pathname).toBe("/api/v1/region/districts/1101");
  });
});
