import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { TenantDto, UpdateTenantInput } from "@/types/tenant.types";

/** `PUT /api/superadmin/tenants/:id` — proxies `PUT /api/v1/superadmin/tenants/:id` (Edit/Suspend). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<TenantDto>(
      `/api/v1/superadmin/tenants/${encodeURIComponent(params.id)}`,
      { method: "PUT", body: body as UpdateTenantInput },
    );
    return NextResponse.json({ tenant: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
