import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { PATCH } from "@/app/api/settings/mode/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

const SESSION = {
  userId: "u1",
  email: "owner@dss-motor.test",
  role: "owner",
  tenantId: "dss-motor",
  vertical: "AUTOMOTIVE",
} as const;

describe("PATCH /api/settings/mode", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when there is no session", async () => {
    resolveRouteSession.mockResolvedValue(null);
    const response = await PATCH(jsonRequest({ mode: "DEV" }));
    expect(response.status).toBe(401);
  });

  it("returns 422 for an invalid mode value (never forwarded to aaos-api)", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    const response = await PATCH(jsonRequest({ mode: "NOT_A_MODE" }));
    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies to aaos-api's PATCH /api/v1/settings/mode, forwarding x-tenant-id and the session email as changedBy", async () => {
    resolveRouteSession.mockResolvedValue(SESSION);
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            tenant: { tenantId: "dss-motor", mode: "DEV" },
            meta: { hasToken: true },
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await PATCH(jsonRequest({ mode: "DEV" }));

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url.pathname).toBe("/api/v1/settings/mode");
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(init?.body as string)).toEqual({
      mode: "DEV",
      changedBy: "owner@dss-motor.test",
    });
    const headers = init?.headers as Record<string, string>;
    expect(headers["x-tenant-id"]).toBe("dss-motor");
  });

  it("omits changedBy when the session has no resolvable email", async () => {
    resolveRouteSession.mockResolvedValue({ ...SESSION, email: undefined });
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ tenant: { mode: "LIVE" }, meta: {} }), { status: 200 }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    await PATCH(jsonRequest({ mode: "LIVE" }));

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({ mode: "LIVE" });
  });
});
