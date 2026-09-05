import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  PropertyObjectiveDto,
  UpdateBusinessContextInput,
} from "@/types/property-objective.types";

export const dynamic = "force-dynamic";

/**
 * `PATCH /api/property-objective/business-context` — proxies
 * `PATCH /api/v1/property-objective/business-context` (AAOS LOOP UPGRADE, Sprint 6 Prompt 15).
 * Forwards the caller's real session email as `updatedBy` when present — same "never fabricate an
 * actor" discipline `app/api/learning/proposals/[id]/approve/route.ts`'s own doc establishes for
 * `decidedBy`.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<UpdateBusinessContextInput>;
  try {
    const data = await callAaosApi<PropertyObjectiveDto>(
      "/api/v1/property-objective/business-context",
      {
        method: "PATCH",
        body: {
          ...(body.avgDealValue !== undefined ? { avgDealValue: body.avgDealValue } : {}),
          ...(body.targetCpl !== undefined ? { targetCpl: body.targetCpl } : {}),
          ...(body.breakevenCpl !== undefined ? { breakevenCpl: body.breakevenCpl } : {}),
          ...(session.email !== undefined ? { updatedBy: session.email } : {}),
        },
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json({ objective: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
