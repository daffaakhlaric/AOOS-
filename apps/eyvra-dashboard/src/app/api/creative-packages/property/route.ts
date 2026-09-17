import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreativePackageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative-packages/property` — proxies `aaos-api`'s real
 * `POST /api/v1/creative-packages/property` (`PropertyCreatePackageBodySchema`). Used by
 * `MetaSettingsPanel`'s per-copy "Brief Kai" action to create a real manual creative-package brief
 * from one of Samantha's real `PropertyAdAngle`-tagged copy recommendations — the same real
 * `listingId` requirement `AndromedaHealthCard`'s own "Brief Kai sekarang" button already
 * establishes (honestly disabled when the caller has no real `listingId` for this campaign).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<CreativePackageDto>("/api/v1/creative-packages/property", {
      method: "POST",
      body,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
