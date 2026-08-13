import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Protects every dashboard route with a valid Supabase Auth session.
 *
 * AAOS-W4A coordinator note #4: the spec's own pseudocode has two real bugs, both fixed here —
 *   1. `await` inside a non-`async function middleware(...)` is a syntax error. This is a real
 *      `async function`.
 *   2. The spec hardcodes `redirect('https://crm.aaos.id')` for a `role === 'sales'` session —
 *      that domain belongs to `apps/aaos-crm`, which is AAOS-W4B, the task AFTER this one, and is
 *      not built yet. The redirect target is `NEXT_PUBLIC_CRM_URL`, defaulting to `"/"` (this
 *      dashboard's own home) so an unset/not-yet-deployed CRM never redirects to a domain that
 *      resolves to nothing.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getSession(request, response);

  if (session === null) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "sales") {
    const crmUrl = process.env.NEXT_PUBLIC_CRM_URL ?? "/";
    return NextResponse.redirect(new URL(crmUrl, request.url));
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
