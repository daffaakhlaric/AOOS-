import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { RegionListDto } from "@/types/region.types";

// Same real-session-cookie-read requirement as every other GET proxy route in this app (see
// `app/api/settings/route.ts`'s comment on this same export).
export const dynamic = "force-dynamic";

/** `GET /api/region/provinces` — proxies `GET /api/v1/region/provinces`. Public reference data
 * (real Indonesian provinces), not tenant data — still requires a real session (same perimeter
 * every `/api/*` route in this app uses) but forwards no `x-tenant-id` scoping, since aaos-api's
 * `RegionController` doesn't consume one either. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<RegionListDto>("/api/v1/region/provinces");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
