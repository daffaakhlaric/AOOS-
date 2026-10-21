import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Carries forward any cookie `getSession` rotated/cleared onto `mutatedResponse` — same real bug
 * fix apps/eyvra-dashboard's own middleware.ts documents (a fresh `NextResponse.redirect` silently
 * drops Set-Cookie headers otherwise, causing a post-login redirect loop).
 */
function carryForwardCookies(target: NextResponse, mutatedResponse: NextResponse): NextResponse {
  for (const cookie of mutatedResponse.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

/**
 * Gates every authenticated route (this phase: only `/command-center` + its proxy routes) with a
 * real Supabase Auth session — safe-by-default denylist, same convention as
 * apps/eyvra-dashboard/src/middleware.ts.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getSession(request, response);

  if (session === null) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return carryForwardCookies(
        NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 }),
        response,
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return carryForwardCookies(NextResponse.redirect(loginUrl), response);
  }

  return response;
}

export const config = {
  /* API route handlers resolve the same Supabase session themselves. Excluding them here prevents
     every parallel Command Center data request from doing the auth lookup twice. */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
