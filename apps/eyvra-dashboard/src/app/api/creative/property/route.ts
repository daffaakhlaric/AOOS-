import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreativePackageDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative/property` — proxies `POST /api/v1/creative-packages/property` (K1/K2,
 * `docs/PROMPT-AAOS-PROPERTY-CAMPAIGN-AND-CREATIVE.md`) — a real PROPERTY creative brief created
 * from `PropertyManualBriefForm.tsx` (K4).
 *
 * Genuinely a separate route from `POST /api/creative` (not a body-shape branch of it), mirroring
 * `aaos-api`'s own K1 decision to give PROPERTY a separate endpoint rather than force a
 * discriminated union onto the existing AUTOMOTIVE schema (see `create-property-package.dto.ts`'s
 * docstring for that reasoning) — the dashboard proxy layer honestly reflects the same split.
 *
 * Tenant-scoped: forwards the caller's real session `tenantId` as `x-tenant-id`, the exact same
 * convention `app/api/listings/route.ts` and the Self-Learning AI Phase C approve/reject routes
 * (`app/api/learning/proposals/:id/approve/route.ts`) already established — `aaos-api`'s
 * `@TenantId()` decorator on `createProperty`/`generateProperty` reads this header.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<CreativePackageDto>("/api/v1/creative-packages/property", {
      method: "POST",
      body: body ?? {},
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ package: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
