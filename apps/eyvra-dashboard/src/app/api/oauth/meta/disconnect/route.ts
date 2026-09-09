import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";

/**
 * `DELETE /api/oauth/meta/disconnect` — proxies `apps/aaos-api`'s real
 * `DELETE /oauth/meta/disconnect?tenantId=` (`MetaOAuthController.disconnectMeta` ->
 * `MetaOAuthService.disconnect`). Reverts `meta_connection_source` to `'manual'` and clears the
 * OAuth-specific encrypted fields — deliberately does NOT touch the pre-existing plain
 * `meta_access_token` manual column (see `MetaOAuthService.disconnect`'s own doc), so a tenant
 * that also has a manual token saved keeps working immediately after disconnecting OAuth.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  try {
    const data = await callAaosApi<{ readonly success: true }>("/oauth/meta/disconnect", {
      method: "DELETE",
      searchParams: { tenantId: session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
