import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

// Same real "must be explicitly marked dynamic or `next build` tries to statically prerender it"
// requirement every other session-reading GET route in this app already documents (see
// `/api/settings/route.ts`'s own comment) — this GET handler reads the caller's real session
// cookies via `resolveRouteSession` on every request.
export const dynamic = "force-dynamic";

interface OAuthConnectResponseDto {
  readonly authorizeUrl: string;
}

/**
 * `GET /api/oauth/meta/connect` — proxies `apps/aaos-api`'s real `GET /oauth/meta/connect?tenantId=`
 * (`MetaOAuthController.connectMeta`), returning `{ authorizeUrl }`. The "Connect dengan Facebook"
 * button fetches this, then does `window.location.href = authorizeUrl` itself — kept as a two-step
 * fetch-then-navigate (not a server-side redirect) so a failure (Meta OAuth not configured) can be
 * shown inline in the card instead of a broken browser navigation.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<OAuthConnectResponseDto>("/oauth/meta/connect", {
      searchParams: { tenantId: session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
