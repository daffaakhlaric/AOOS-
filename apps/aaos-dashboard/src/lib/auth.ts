import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
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
 *
 * Uses `getAll`/`setAll` — the installed `@supabase/ssr@0.5.2`'s own type definitions name the
 * single-cookie `get`/`set`/`remove` shape `CookieMethodsServerDeprecated`; this is the
 * currently-supported, officially documented pattern. `setAll` also mirrors every cookie onto
 * `request.cookies`, not just `response.cookies` — required so that if `@supabase/ssr` rotates or
 * clears a cookie mid-request (e.g. an expired/invalid session token), any code re-reading
 * `request.cookies` later in the same invocation sees the corrected value rather than the stale
 * one that triggered the rotation in the first place.
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
): ReturnType<typeof createServerClient> {
  const { url, anonKey } = requireSupabaseEnv();
  return createServerClient(url, anonKey, {
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

/**
 * Resolves the current session (if any) from `request`'s cookies, mutating `response` with any
 * refreshed/rotated/cleared auth cookies `@supabase/ssr` decides to issue. Returns `null` for no
 * session — never throws for the "not logged in" case (that's an expected, not exceptional,
 * outcome).
 *
 * IMPORTANT for callers: `response` is mutated in place (cookies are added via
 * `response.cookies.set(...)`), but if a caller discards this exact `response` object and
 * constructs a *different* one to return (e.g. `NextResponse.redirect(...)`), those cookie
 * mutations are silently lost and never reach the browser. This was the real cause of the
 * post-login redirect loop reported for this middleware: on the "no session" branch, a fresh
 * `NextResponse.redirect(loginUrl)` was returned instead of the `response` that had just been
 * mutated — so any cookie Supabase tried to clear/rotate while determining the session was
 * invalid never made it to the browser, which kept resending the same broken cookie on every
 * subsequent request. See `middleware.ts` for how the redirect paths now carry `response`'s
 * cookies forward.
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
