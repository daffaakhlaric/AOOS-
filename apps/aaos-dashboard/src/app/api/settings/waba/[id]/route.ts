import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { UpdateWabaConfigInput, WabaConfigDto } from "@/types/tenant.types";

/** `PUT/DELETE /api/settings/waba/:id` — proxies `PUT/DELETE /api/v1/settings/waba/:id` (a WABA row's [Edit]/[Hapus]). */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<WabaConfigDto>(
      `/api/v1/settings/waba/${encodeURIComponent(params.id)}`,
      {
        method: "PUT",
        body: body as UpdateWabaConfigInput,
        headers: { "x-tenant-id": session.tenantId },
      },
    );
    return NextResponse.json({ wabaConfig: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    await callAaosApi<{ readonly deleted: true }>(
      `/api/v1/settings/waba/${encodeURIComponent(params.id)}`,
      { method: "DELETE", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
