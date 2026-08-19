import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * MENU RESTRUCTURE FINAL — exact-path redirects for the 3 routes this restructure moved/retired.
 * `/leads` is retired entirely (its flat list became `/jessy/contacts`, its chat room became
 * `/jessy/inbox` — see `docs/PROMPT-AAOS-MENU-RESTRUCTURE-FINAL.md`'s coordinator note #2), so
 * (unlike the spec's own middleware sketch, which sends `/leads` there loosely) it redirects to
 * `/jessy/inbox`, matching the spec's original REDIRECTS map. `/knowledge`/`/simulator` simply
 * moved under `/jessy/*` with identical content.
 */
const REDIRECTS: Readonly<Record<string, string>> = {
  "/leads": "/jessy/inbox",
  "/knowledge": "/jessy/knowledge",
  "/simulator": "/jessy/simulator",
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

  if (session === null) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return carryForwardCookies(NextResponse.redirect(loginUrl), response);
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
