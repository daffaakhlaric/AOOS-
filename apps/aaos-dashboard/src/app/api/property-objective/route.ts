import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type {
  CreatePropertyObjectiveInput,
  PropertyObjectiveDto,
} from "@/types/property-objective.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET/POST /api/property-objective` — proxies `GET/POST /api/v1/property-objective` (Phase O2's
 * genuinely separate PROPERTY sibling of `api/objective/route.ts`). Same real
 * `resolveRouteSession` → 401 → `callAaosApi` with `x-tenant-id: session.tenantId` convention
 * `api/listings/route.ts` established (`property-objective.controller.ts`'s `get`/`create` are
 * real `@TenantId()`-scoped, unlike `budget-suggestion` below).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<PropertyObjectiveDto>("/api/v1/property-objective", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ objective: data });
  } catch (error) {
    if (error instanceof AaosApiError && error.statusCode === 404) {
      return NextResponse.json({ objective: null });
    }
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
    const data = await callAaosApi<PropertyObjectiveDto>("/api/v1/property-objective", {
      method: "POST",
      body: body as CreatePropertyObjectiveInput,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ objective: data }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
