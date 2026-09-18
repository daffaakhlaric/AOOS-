import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  CreateGrowthObjectiveInput,
  GrowthObjectiveListResponseDto,
  GrowthObjectiveResponseDto,
} from "@/types/growth-objective.types";

// See `app/api/settings/route.ts`'s comment on this same export — this handler also reads the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET/POST /api/growth-objectives` — proxies `GET/POST /api/v1/growth-objectives` (EYVRA —
 * SAMANTHA V2 Phase 15, `growth_objectives`: a business-GOAL tracker, NOT the older, unrelated
 * `/objective` `property_objective` feature — see `growth-objective.types.ts`'s own doc). The
 * real backend's `GET` takes no query params (verified against `GrowthObjectivesController.list`
 * — tenant-scoped only, via `@TenantId()`), so unlike `listings/route.ts` there is no
 * `searchParams` passthrough here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<GrowthObjectiveListResponseDto>("/api/v1/growth-objectives", {
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<GrowthObjectiveResponseDto>("/api/v1/growth-objectives", {
      method: "POST",
      body: body as CreateGrowthObjectiveInput,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ objective: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
