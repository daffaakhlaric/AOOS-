import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { OAuthStartResponseDto } from "@/types/sosmed.types";

/**
 * `GET /api/sosmed/public/connect/:token/start` — proxies `aaos-api`'s real, PUBLIC
 * `GET /api/v1/sosmed/oauth/sales/:token/start` for the `/connect/sales/:token` page (a sales
 * human's own un-authenticated phone browser — never has an AAOS dashboard session). Lives under
 * its own `/api/sosmed/public/*` prefix, added to `middleware.ts`'s `PUBLIC_PATHS`, rather than
 * `/api/sosmed/*` generally — keeps every OTHER `/api/sosmed/*` route (accounts, posts, oauth
 * start/connect-links) session-gated by default, same "protect everything, explicitly allowlist
 * what's public" discipline `middleware.ts`'s own docstring establishes.
 *
 * This proxy route itself still runs server-side with `AAOS_API_KEY` (via `callAaosApi`) even
 * though the upstream endpoint doesn't require it — harmless extra header, and keeps this route
 * using the exact same `callAaosApi` helper (and its `AaosApiError` handling) every other proxy
 * route in this app uses, rather than inventing a second unauthenticated-fetch helper.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
): Promise<NextResponse> {
  try {
    const result = await callAaosApi<OAuthStartResponseDto>(
      `/api/v1/sosmed/oauth/sales/${encodeURIComponent(params.token)}/start`,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
