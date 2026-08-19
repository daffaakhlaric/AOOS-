import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resolveRouteSession = vi.fn();

vi.mock("@/lib/route-session", () => ({
  resolveRouteSession: (...args: unknown[]) => resolveRouteSession(...args),
}));

import { POST } from "@/app/api/superadmin/impersonate/route";

function jsonRequest(body: unknown = {}): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

describe("POST /api/superadmin/impersonate", () => {
  beforeEach(() => {
    process.env["AAOS_API_BASE_URL"] = "http://localhost:3000";
    process.env["AAOS_API_KEY"] = "test-key";
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns 403 when the caller is not a real superadmin session", async () => {
    resolveRouteSession.mockResolvedValue({ userId: "u1", role: "manager", tenantId: "dss-motor" });
    const response = await POST(jsonRequest({ tenantId: "dss-motor" }));
    expect(response.status).toBe(403);
  });

  it("returns 400 when tenantId is missing from the body", async () => {
    resolveRouteSession.mockResolvedValue({
      userId: "s1",
      email: "superadmin@aaos.id",
      role: "superadmin",
      tenantId: "dss-motor",
    });
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
  });

  it("forwards the REAL superadmin's own actorEmail/actorId (never client-supplied) to aaos-api", async () => {
    resolveRouteSession.mockResolvedValue({
      userId: "s1",
      email: "superadmin@aaos.id",
      role: "superadmin",
      tenantId: "dss-motor",
    });
    const fetchMock = vi.fn(
      async (_url: URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            tenantId: "dss-motor",
            adminEmail: "admin@dss-motor.id",
            actionLink: "https://example.test/verify",
          }),
          { status: 200 },
        ),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const response = await POST(jsonRequest({ tenantId: "dss-motor" }));
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0]!;
    const sentBody = JSON.parse(String(init?.body)) as { actorEmail: string; actorId: string };
    expect(sentBody.actorEmail).toBe("superadmin@aaos.id");
    expect(sentBody.actorId).toBe("s1");
  });
});
