import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/dashboard.types";

/** `aaos-api`'s `GET /api/v1/leads` is per-branch only (`GetLeadsQueryDto.branchId` is required) — there is no manager-wide "all branches" endpoint on `aaos-api`. This app's DSS Motor branch ids are fixed (mirrors `@aos/branch-manager`'s `ALL_BRANCH_IDS`), so the manager view (spec "leads/page.tsx — all leads overview") fans this proxy route out across all 4 and concatenates. */
const ALL_BRANCH_IDS = ["BINTARO", "CINERE", "UMUM", "BANDUNG"] as const;

/** `GET /api/leads?branchId=BINTARO` — proxies one branch. `GET /api/leads` (no query) — fans out across every branch for the manager overview. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const branchId = request.nextUrl.searchParams.get("branchId");
  const branchIds = branchId !== null ? [branchId] : ALL_BRANCH_IDS;

  try {
    const results = await Promise.all(
      branchIds.map((id) =>
        callAaosApi<readonly LeadDto[]>("/api/v1/leads", { searchParams: { branchId: id } }),
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
