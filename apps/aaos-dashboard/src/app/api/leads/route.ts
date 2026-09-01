import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { LeadDto } from "@/types/dashboard.types";

/** `aaos-api`'s `GET /api/v1/leads` is per-branch only (`GetLeadsQueryDto.branchId` is required) — there is no manager-wide "all branches" endpoint on `aaos-api`. This app's DSS Motor branch ids are fixed (mirrors `@aos/branch-manager`'s `ALL_BRANCH_IDS`), so the manager view (spec "leads/page.tsx — all leads overview") fans this proxy route out across all 4 and concatenates. */
const ALL_BRANCH_IDS = ["BINTARO", "CINERE", "UMUM", "BANDUNG"] as const;

// See `app/api/settings/route.ts`'s comment on this same export — this GET handler also reads
// the caller's real session cookies on every request.
export const dynamic = "force-dynamic";

/**
 * `GET /api/leads?branchId=BINTARO` — proxies one branch. `GET /api/leads` (no query) — fans out
 * across every branch for the manager overview.
 *
 * PROPERTY-TENANT-ISOLATION Phase 1 (security fix): forwards the real logged-in session's
 * `tenantId` as `x-tenant-id` — the SAME header convention `modules/settings`'s proxy routes
 * already use (`common/tenant-context.ts`'s `resolveTenantId` on the `aaos-api` side) — instead
 * of the previous no-tenant behavior.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const branchId = request.nextUrl.searchParams.get("branchId");
  const branchIds = branchId !== null ? [branchId] : ALL_BRANCH_IDS;

  try {
    const results = await Promise.all(
      branchIds.map((id) =>
        callAaosApi<readonly LeadDto[]>("/api/v1/leads", {
          searchParams: { branchId: id },
          headers: { "x-tenant-id": session.tenantId },
        }),
      ),
    );
    return NextResponse.json({ leads: results.flat() });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
