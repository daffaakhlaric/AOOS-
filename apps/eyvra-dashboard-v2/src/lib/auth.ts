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
const DEFAULT_VERTICAL: Vertical = "AUTOMOTIVE";

export interface SessionInfo {
  readonly userId: string;
  readonly email?: string;
  readonly role: UserRole;
  readonly tenantId: string;
  readonly vertical: Vertical;
}

function parseRole(raw: unknown): UserRole {
  if (raw === "manager" || raw === "owner" || raw === "sales" || raw === "superadmin") {
    return raw;
  }
  return "sales";
}

function parseTenantId(raw: unknown): string {
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  return DEFAULT_TENANT_ID;
}

function parseVertical(raw: unknown): Vertical {
  if (raw === "AUTOMOTIVE" || raw === "PROPERTY") {
    return raw;
  }
  return DEFAULT_VERTICAL;
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
  const metadata = user.user_metadata as Record<string, unknown> | null;
  return {
    userId: user.id,
    email: user.email,
    role: parseRole(metadata?.["role"]),
    tenantId: parseTenantId(metadata?.["tenantId"]),
    vertical: parseVertical(metadata?.["vertical"]),
  };
}
