import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreativePackageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative/property/:id/generate` — proxies
 * `POST /api/v1/creative-packages/property/:id/generate` (K2). Same tenant-forwarding convention
 * as `POST /api/creative/property` above: `x-tenant-id: <session.tenantId>`, read by `aaos-api`'s
 * `@TenantId()` on `CreativePackagesController.generateProperty`.
 *
 * Like the AUTOMOTIVE `POST /api/creative/:id/generate`, this is the only route that spends real
 * Kie AI credits for a PROPERTY brief, reachable only from an explicit per-brief click — no timer,
 * no cron, no auto-mode.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<CreativePackageDto>(
      `/api/v1/creative-packages/property/${encodeURIComponent(params.id)}/generate`,
      { method: "POST", body: {}, headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ package: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
