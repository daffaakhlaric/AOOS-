import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { CreateTenantInput, ListTenantsDto, TenantDto } from "@/types/tenant.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET/POST /api/superadmin/tenants` — proxies `GET/POST /api/v1/superadmin/tenants`.
 * `middleware.ts` already gates every `/api/superadmin/*` path to a real `role === 'superadmin'`
 * session before this handler ever runs; the `resolveRouteSession` check here is defense-in-depth
 * (never trust a single enforcement layer for an endpoint this sensitive), not the only guard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  try {
    const data = await callAaosApi<ListTenantsDto>("/api/v1/superadmin/tenants");
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
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<TenantDto>("/api/v1/superadmin/tenants", {
      method: "POST",
      body: body as CreateTenantInput,
    });
    return NextResponse.json({ tenant: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
