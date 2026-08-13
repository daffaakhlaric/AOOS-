import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/** `manager`/`owner` → full dashboard access. `sales` → redirected out to `apps/aaos-crm` (W4B, not yet built — see `middleware.ts`). Unknown/missing role defaults to `sales` (least privilege), never to a privileged role. */
export type UserRole = "manager" | "owner" | "sales";

export interface SessionInfo {
  readonly userId: string;
  readonly email?: string;
  readonly role: UserRole;
}

function parseRole(raw: unknown): UserRole {
  if (raw === "manager" || raw === "owner" || raw === "sales") {
    return raw;
  }
  return "sales";
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

/**
 * A Supabase client that reads/writes the auth session via `request`/`response` cookies — the
 * `@supabase/ssr` pattern for Next.js Edge middleware, so `getSession` below can verify a
 * session set by `lib/supabase.ts`'s browser client (which also persists to cookies, not
 * `localStorage`, for exactly this reason).
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });
}

/**
 * Resolves the current session (if any) from `request`'s cookies, mutating `response` with any
 * refreshed auth cookies `@supabase/ssr` decides to issue. Returns `null` for no session — never
 * throws for the "not logged in" case (that's an expected, not exceptional, outcome).
 */
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
  return {
    userId: user.id,
    email: user.email,
    role: parseRole((user.user_metadata as Record<string, unknown> | null)?.["role"]),
  };
}
