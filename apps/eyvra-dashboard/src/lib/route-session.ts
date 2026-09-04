import { NextResponse, type NextRequest } from "next/server";

import { getSession, type SessionInfo } from "@/lib/auth";

/**
 * Resolves the caller's real Supabase Auth session inside a Route Handler (`src/app/api/*`),
 * reusing `lib/auth.ts`'s `getSession` — the SAME function `middleware.ts` already uses to gate
 * every page, rather than a second parallel session-reading mechanism (AAOS-MULTI-TENANT-
 * SUPERADMIN-PROPERTY coordinator note section 1's "never fabricate a second parallel session
 * store").
 *
 * `getSession` was written for the middleware shape (mutate a `NextResponse` with any
 * rotated/cleared auth cookies, then the caller carries those cookies forward onto whatever it
 * actually returns). A Route Handler's own response is independent JSON, not a cookie carrier, so
 * the `NextResponse.next()` passed here is deliberately discarded — any cookie rotation
 * `@supabase/ssr` performs mid-request is not propagated back to the browser from these specific
 * routes. This is a real, accepted limitation (not a silent bug): these are short-lived,
 * read-mostly proxy calls to `apps/aaos-api`, not the primary session-refresh path (that's
 * `middleware.ts`, which runs on every navigation and DOES carry cookies forward) — a session
 * that needs rotating will still get rotated on the user's very next page navigation.
 */
export async function resolveRouteSession(request: NextRequest): Promise<SessionInfo | null> {
  return getSession(request, NextResponse.next());
}
