import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { UpdateWebhookConfigInput, WebhookConfigDto } from "@/types/tenant.types";

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET/PUT /api/superadmin/webhook-config` — proxies `GET/PUT /api/v1/superadmin/webhook-config`
 * (the GLOBAL, not per-tenant, Meta/WhatsApp webhook verify-token + app-secret override card).
 * Mirrors `api/superadmin/tenants/route.ts`'s exact `resolveRouteSession`+
 * `role !== 'superadmin'` guard pattern.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  try {
    const data = await callAaosApi<WebhookConfigDto>("/api/v1/superadmin/webhook-config");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null || session.role !== "superadmin") {
    return NextResponse.json({ error: { message: "Forbidden" } }, { status: 403 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<WebhookConfigDto>("/api/v1/superadmin/webhook-config", {
      method: "PUT",
      body: body as UpdateWebhookConfigInput,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
