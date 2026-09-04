import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

/**
 * AAOS-SOSMED-AUTOMATION Phase 5: `/connect/sales` (the page) and `/api/sosmed/public` (the one
 * proxy route it calls) are the ONLY public sosmed paths — a sales human's own un-authenticated
 * phone browser reaches both via the connect-link Ahmad/Budi is sent over WhatsApp, mirroring
 * `/auth/callback`'s existing "public page + its own narrow API surface" precedent above. Every
 * other `/sosmed/*` page and `/api/sosmed/*` route stays behind the default session gate.
 */
const PUBLIC_PATHS = [
  "/login",
  "/superadmin/login",
  "/auth/callback",
  "/connect/sales",
  "/api/sosmed/public",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** `/superadmin/*` pages and `/api/superadmin/*` route handlers (Part 1's Super Admin panel + tenant CRUD/impersonate proxy) — everything under here except the login page itself (`/superadmin/login`, already in `PUBLIC_PATHS`) requires a REAL `role === 'superadmin'` session, never just "any authenticated session" (coordinator note: "gated so only a real role='superadmin' session can call them"). */
function isSuperadminPath(pathname: string): boolean {
  return (
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    pathname === "/api/superadmin" ||
    pathname.startsWith("/api/superadmin/")
  );
}

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * MENU RESTRUCTURE FINAL — exact-path redirects for stale bookmarks to routes this restructure
 * moved/retired. `/knowledge`/`/simulator` simply moved under `/clara/*` with identical content.
 *
 * AGENT RENAME Phase 8: `/jessy/*` was itself renamed to `/clara/*` (Jessy → Clara). Same
 * exact-path stale-link pattern as above, this time for every real `/jessy/*` page that existed
 * before the rename, so no existing bookmark 404s.
 *
 * EYVRA MENU RESTRUCTURE Sprint 1: the `/leads` entry that used to live here (redirecting to
 * `/clara/inbox`) is REMOVED — `/leads` is now reclaimed as a real page of its own (the new
 * "Leads" hub, `src/app/(app)/leads/page.tsx`), not a compatibility redirect. This map running
 * ahead of the app router means leaving `/leads` in here would have silently swallowed every
 * request to the new page before it ever rendered.
 *
 * EYVRA MENU RESTRUCTURE Sprint 4 (PROMPT 10, double-hop fix): every `/clara/*` page these entries
 * used to point at is now ITSELF one of Sprint 1's own `redirect(...)` stubs (`/clara/analytics` →
 * `/dashboard`, `/clara/contacts` → `/leads?tab=semua`, `/clara/inbox` → `/leads`,
 * `/clara/knowledge` → `/leads?tab=knowledge-base`, `/clara/recycling` → `/leads?tab=recycling`,
 * `/clara/simulator` → `/activity`). Redirecting here into another redirect was a real, silent
 * double-hop (`/jessy/inbox` → `/clara/inbox` → `/leads`, an extra network round-trip every time)
 * — every target below now points straight at the real final destination instead.
 */
const REDIRECTS: Readonly<Record<string, string>> = {
  "/knowledge": "/leads?tab=knowledge-base",
  "/simulator": "/activity",
  "/jessy/analytics": "/dashboard",
  "/jessy/contacts": "/leads?tab=semua",
  "/jessy/inbox": "/leads",
  "/jessy/knowledge": "/leads?tab=knowledge-base",
  "/jessy/recycling": "/leads?tab=recycling",
  "/jessy/simulator": "/activity",
};

/**
 * Returns a new response of the given kind (redirect or pass-through) carrying forward every
 * cookie `getSession` wrote onto `mutatedResponse` — without this, a fresh `NextResponse.redirect`
 * silently drops any Set-Cookie header Supabase's `setAll` callback issued (e.g. to clear or
 * rotate an invalid session cookie while determining the session was unusable), so the browser
 * keeps resending the same broken cookie on the very next request. This was the real cause of the
 * reported post-login redirect loop — see the long comment on `getSession` in `lib/auth.ts`.
 */
function carryForwardCookies(target: NextResponse, mutatedResponse: NextResponse): NextResponse {
  for (const cookie of mutatedResponse.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

/**
 * Protects every route except `PUBLIC_PATHS` with a valid Supabase Auth session — a safe-by-default
 * denylist (protect everything, explicitly allowlist what's public), not the inverse. Deliberately
 * NOT narrowed to only match `/dashboard`, `/meta-ads`, `/objective`, `/creative`, `/branches`,
 * `/knowledge`: this app also serves `/leads` and `/simulator` as real authenticated pages (see
 * `src/app/(app)/`), and an allowlist of specific protected prefixes fails OPEN for any route not
 * on the list — including those two today, and any future page added later without remembering to
 * update the matcher. `PUBLIC_PATHS` failing closed (protect-by-default) is the safer direction for
 * an internal manager tool.
 *
 * AAOS-W4A coordinator note #4: the spec's own pseudocode has two real bugs, both fixed here —
 *   1. `await` inside a non-`async function middleware(...)` is a syntax error. This is a real
 *      `async function`.
 *   2. The spec hardcodes `redirect('https://crm.aaos.id')` for a `role === 'sales'` session —
 *      that domain belongs to `apps/aaos-crm`, which is AAOS-W4B, the task AFTER this one, and is
 *      not built yet.
 *
 * Real bug found and fixed after AAOS-W4A shipped: this used to fall back to redirecting
 * `role === 'sales'` sessions to `"/"` when `NEXT_PUBLIC_CRM_URL` was unset. That is a guaranteed
 * infinite redirect: `/` is itself a protected path (not in `PUBLIC_PATHS`), so middleware runs on
 * it again, sees the same still-`sales` session, and redirects to `"/"` again — a self-redirect
 * that never terminates (`ERR_TOO_MANY_REDIRECTS`). Any Supabase user without `user_metadata.role`
 * set to `"manager"`/`"owner"` hits this by default (`parseRole` in `lib/auth.ts` falls back to
 * `"sales"` for a missing/unrecognized role), which is the common case for a freshly created
 * account. Fix: only redirect sales sessions away when a real `NEXT_PUBLIC_CRM_URL` is configured;
 * with no CRM to send them to, let them through rather than bounce them in a loop with nowhere to
 * land.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const redirectTarget = REDIRECTS[request.nextUrl.pathname];
  if (redirectTarget !== undefined) {
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getSession(request, response);

  const superadminPath = isSuperadminPath(request.nextUrl.pathname);

  if (session === null) {
    // A `/api/superadmin/*` call with no session at all is a direct/unauthenticated API call —
    // an honest 401 JSON body, never a redirect an API client can't follow.
    if (superadminPath && isApiPath(request.nextUrl.pathname)) {
      return carryForwardCookies(
        NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 }),
        response,
      );
    }
    const loginUrl = new URL(superadminPath ? "/superadmin/login" : "/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return carryForwardCookies(NextResponse.redirect(loginUrl), response);
  }

  if (superadminPath && session.role !== "superadmin") {
    if (isApiPath(request.nextUrl.pathname)) {
      return carryForwardCookies(
        NextResponse.json({ error: { message: "Forbidden — superadmin only" } }, { status: 403 }),
        response,
      );
    }
    return carryForwardCookies(
      NextResponse.redirect(new URL("/superadmin/login", request.url)),
      response,
    );
  }

  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL;
  if (session.role === "sales" && crmUrl !== undefined && crmUrl.length > 0) {
    return carryForwardCookies(NextResponse.redirect(new URL(crmUrl, request.url)), response);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every path except: Next.js internals, static files, and the favicon — mirrors the
     * standard Next.js middleware matcher recommendation.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
