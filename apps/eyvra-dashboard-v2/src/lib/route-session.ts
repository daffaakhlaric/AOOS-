import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession, type SessionInfo } from "./auth";
/** Route handlers propagate rotated cookies onto their actual Next response cookie store. */
export async function resolveRouteSession(request: NextRequest): Promise<SessionInfo | null> {
  const response = NextResponse.next();
  const session = await getSession(request, response);
  for (const cookie of response.cookies.getAll()) cookies().set(cookie);
  return session;
}
