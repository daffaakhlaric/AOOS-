import type { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createServerClient = vi.fn((..._args: unknown[]) => ({ auth: { getUser } }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

import { createSupabaseMiddlewareClient, getSession } from "@/lib/auth";

/** Minimal request double, pre-cast once here so call sites need no `any`/disable comment. */
function buildRequest(): NextRequest {
  return { cookies: { get: () => undefined } } as unknown as NextRequest;
}

/** Minimal response double, pre-cast once here so call sites need no `any`/disable comment. */
function buildResponse(): NextResponse {
  return { cookies: { set: () => undefined } } as unknown as NextResponse;
}

describe("createSupabaseMiddlewareClient / getSession", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://test-project.supabase.co";
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("resolves null when there is no user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session).toBeNull();
  });

  it("resolves the session with role/tenantId/vertical from user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "manager@dssmotor.id",
          user_metadata: { role: "manager", tenantId: "dss-motor", vertical: "AUTOMOTIVE" },
        },
      },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session).toEqual({
      userId: "user-1",
      email: "manager@dssmotor.id",
      role: "manager",
      tenantId: "dss-motor",
      vertical: "AUTOMOTIVE",
    });
  });

  it("defaults role to 'sales' when user_metadata.role is missing/unknown", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-2", email: "x@y.z", user_metadata: {} } },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.role).toBe("sales");
  });

  it("resolves role 'superadmin' from user_metadata (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY)", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "user-3", email: "superadmin@aaos.id", user_metadata: { role: "superadmin" } },
      },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.role).toBe("superadmin");
  });

  it("defaults tenantId to DEFAULT_TENANT_ID ('dss-motor') when user_metadata.tenantId is missing — every pre-existing account", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "user-4", email: "old@dssmotor.id", user_metadata: { role: "manager" } },
      },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.tenantId).toBe("dss-motor");
  });

  it("defaults vertical to AUTOMOTIVE when user_metadata.vertical is missing/unknown", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-5", email: "x@y.z", user_metadata: { vertical: "NOT_REAL" } } },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.vertical).toBe("AUTOMOTIVE");
  });

  it("resolves vertical PROPERTY from user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-6",
          email: "admin@propertyklik.id",
          user_metadata: { role: "owner", tenantId: "propertyklik-demo", vertical: "PROPERTY" },
        },
      },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.vertical).toBe("PROPERTY");
    expect(session?.tenantId).toBe("propertyklik-demo");
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not set", () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    expect(() => createSupabaseMiddlewareClient(buildRequest(), buildResponse())).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
