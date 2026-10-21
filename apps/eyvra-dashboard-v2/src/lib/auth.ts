import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Re-implemented 1:1 from apps/eyvra-dashboard/src/lib/auth.ts (per this app's own build brief:
 * same real Supabase Auth project, same real SessionInfo shape, no cross-import between the two
 * apps). `manager`/`owner` -> full access, `sales` -> out of scope for this pass (no CRM app to
 * redirect to here yet), `superadmin` untouched.
 */
export type UserRole = "manager" | "owner" | "sales" | "superadmin";
export type Vertical = "AUTOMOTIVE" | "PROPERTY";

export const DEFAULT_TENANT_ID = "dss-motor";

export interface SessionInfo {
  readonly userId: string;
  readonly email?: string;
  readonly role: UserRole;
  readonly tenantId: string;
  readonly vertical: Vertical;
}

function requireSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || url.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  if (anonKey === undefined || anonKey.length === 0) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  }
  return { url, anonKey };
}

/** Same `@supabase/ssr` Edge-middleware cookie pattern as apps/eyvra-dashboard/src/lib/auth.ts. */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  return createServerClient(url, anonKey, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}

/** Resolves the current session (if any), mutating `response` with any rotated/cleared cookies. */
export async function getSession(
  request: NextRequest,
  response: NextResponse,
): Promise<SessionInfo | null> {
  const supabase = createSupabaseMiddlewareClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return null;
  }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) return null;
  const hint = request.cookies.get("skorpintar-workspace")?.value;
  try {
    const contextResponse = await fetch(
      new URL("/api/v1/auth/context", process.env.AAOS_API_BASE_URL),
      {
        headers: {
          "x-api-key": process.env.AAOS_API_KEY ?? "",
          authorization: "Bearer " + sessionData.session.access_token,
          ...(hint ? { "x-tenant-id": hint } : {}),
        },
        cache: "no-store",
      },
    );
    if (!contextResponse.ok) return null;
    const trusted = await contextResponse.json();
    if (
      trusted.userId !== user.id ||
      !trusted.membershipId ||
      !trusted.tenantId ||
      !["PROPERTY", "AUTOMOTIVE"].includes(trusted.vertical)
    )
      return null;
    const role: UserRole = trusted.superadmin
      ? "superadmin"
      : trusted.role === "OWNER"
        ? "owner"
        : ["ADMIN", "MEDIA_BUYER"].includes(trusted.role)
          ? "manager"
          : "sales";
    return {
      userId: user.id,
      email: user.email,
      role,
      tenantId: trusted.tenantId,
      vertical: trusted.vertical,
    };
  } catch {
    return null;
  }
}
