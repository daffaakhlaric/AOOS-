import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/crm.types";

/** `GET /api/leads?branchId=CINERE` — proxies `aaos-api`'s `GET /api/v1/leads` (per-branch, required query param). Powers the hot-leads inbox's initial fetch; `lib/realtime.ts` keeps it live after that. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const branchId = request.nextUrl.searchParams.get("branchId");
  if (branchId === null || branchId.length === 0) {
    return NextResponse.json({ error: { message: "branchId is required" } }, { status: 400 });
  }

  try {
    const leads = await callAaosApi<readonly LeadDto[]>("/api/v1/leads", {
      searchParams: { branchId },
    });
    return NextResponse.json({ leads });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
