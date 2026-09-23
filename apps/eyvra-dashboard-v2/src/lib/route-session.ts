import { NextResponse, type NextRequest } from "next/server";

import { getSession, type SessionInfo } from "@/lib/auth";

/** Re-implemented 1:1 from apps/eyvra-dashboard/src/lib/route-session.ts — same real convention. */
export async function resolveRouteSession(request: NextRequest): Promise<SessionInfo | null> {
  return getSession(request, NextResponse.next());
}
