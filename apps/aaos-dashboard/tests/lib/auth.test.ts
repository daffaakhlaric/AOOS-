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

  it("resolves the session with role from user_metadata", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "manager@dssmotor.id", user_metadata: { role: "manager" } },
      },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session).toEqual({ userId: "user-1", email: "manager@dssmotor.id", role: "manager" });
  });

  it("defaults role to 'sales' when user_metadata.role is missing/unknown", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "user-2", email: "x@y.z", user_metadata: {} } },
    });
    const session = await getSession(buildRequest(), buildResponse());
    expect(session?.role).toBe("sales");
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not set", () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    expect(() => createSupabaseMiddlewareClient(buildRequest(), buildResponse())).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
  });
});
