import type { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => getSession(...args),
}));

import { resolveRouteSession } from "@/lib/route-session";

function buildRequest(): NextRequest {
  return { cookies: { getAll: () => [] } } as unknown as NextRequest;
}

describe("resolveRouteSession", () => {
  beforeEach(() => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test-project.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon-key";
  });
  afterEach(() => vi.clearAllMocks());

  it("delegates to lib/auth's getSession", async () => {
    getSession.mockResolvedValue({
      userId: "u1",
      role: "manager",
      tenantId: "dss-motor",
      vertical: "AUTOMOTIVE",
    });
    const session = await resolveRouteSession(buildRequest());
    expect(session?.tenantId).toBe("dss-motor");
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("returns null when there is no session", async () => {
    getSession.mockResolvedValue(null);
    const session = await resolveRouteSession(buildRequest());
    expect(session).toBeNull();
  });
});
