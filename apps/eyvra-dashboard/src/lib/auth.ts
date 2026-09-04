import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * `manager`/`owner` → full dashboard access (tenant admin). `sales` → redirected out to
 * `apps/aaos-crm`. `superadmin` → AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1 addition, a real
 * Supabase Auth user with `user_metadata.role = 'superadmin'` (coordinator note #1 — never a
 * hardcoded env-var password), gated to `/superadmin/*` only (see `middleware.ts`). Unknown/
 * missing role defaults to `sales` (least privilege), never to a privileged role.
 */
export type UserRole = "manager" | "owner" | "sales" | "superadmin";

/** `AUTOMOTIVE` (DSS Motor, existing) or `PROPERTY` (PropertyKlik, Phase 2) — read from `user_metadata.vertical`. Defaults to `AUTOMOTIVE` for any pre-existing account provisioned before this field existed (same least-surprise default `DEFAULT_TENANT_ID`/`DEFAULT_VERTICAL` use in `apps/aaos-api`'s `tenants` migration). */
export type Vertical = "AUTOMOTIVE" | "PROPERTY";

/** Real, already-live `dss-motor` tenant's id — the same literal `apps/aaos-api`'s `common/tenant-context.ts`/`supabase/migrations/007_tenants_waba.sql` fall back to, kept in sync deliberately (see this file's `parseTenantId` doc). */
export const DEFAULT_TENANT_ID = "dss-motor";
const DEFAULT_VERTICAL: Vertical = "AUTOMOTIVE";

export interface SessionInfo {
  readonly userId: string;
  readonly email?: string;
  readonly role: UserRole;
  /** From `user_metadata.tenantId` (coordinator note section 1's real Supabase Auth user shape — never a separate `tenant_admins` table). Falls back to `DEFAULT_TENANT_ID` for any account with no `tenantId` set yet (every account provisioned before this field existed, i.e. every real DSS Motor manager/owner today) so nothing breaks for the existing single-tenant deployment. */
  readonly tenantId: string;
  /** From `user_metadata.vertical`. Falls back to `DEFAULT_VERTICAL`, same rationale as `tenantId`. */
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
  const metadata = user.user_metadata as Record<string, unknown> | null;
  return {
    userId: user.id,
    email: user.email,
    role: parseRole(metadata?.["role"]),
    tenantId: parseTenantId(metadata?.["tenantId"]),
    vertical: parseVertical(metadata?.["vertical"]),
  };
}
