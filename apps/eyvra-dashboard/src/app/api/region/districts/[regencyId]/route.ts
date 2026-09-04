import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { RegionListDto } from "@/types/region.types";

export const dynamic = "force-dynamic";

/** `GET /api/region/districts/:regencyId` — proxies `GET /api/v1/region/districts/:regencyId`.
 * See `app/api/region/provinces/route.ts`'s docstring for the "public reference data, no
 * tenant-scoping" reasoning. */
export async function GET(
  request: NextRequest,
  { params }: { params: { regencyId: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<RegionListDto>(
      `/api/v1/region/districts/${encodeURIComponent(params.regencyId)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
