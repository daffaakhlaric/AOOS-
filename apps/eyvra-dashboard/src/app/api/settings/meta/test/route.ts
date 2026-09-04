import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { TestConnectionResultDto } from "@/types/tenant.types";

/** `POST /api/settings/meta/test` — proxies `POST /api/v1/settings/meta/test` ("Test Koneksi", a real call to Meta's Graph API using the tenant's OWN saved token, never the env default — see `SettingsService.testMetaConnection`'s class doc). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<TestConnectionResultDto>("/api/v1/settings/meta/test", {
      method: "POST",
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
