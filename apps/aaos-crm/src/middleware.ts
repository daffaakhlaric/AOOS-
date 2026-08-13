import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Protects every CRM route with a valid Supabase Auth session (spec "Redirect ke login jika tidak authenticated"). Mirrors `apps/aaos-dashboard`'s `middleware.ts` (a real `async function`, not the spec's own buggy non-async pseudocode). */
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every path except: Next.js internals, static files, the manifest, and the favicon —
     * mirrors the standard Next.js middleware matcher recommendation.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
