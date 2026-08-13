import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/crm.types";

/** `GET /api/leads/my?salesHumanId=...` — proxies `aaos-api`'s `GET /api/v1/leads/my`. Powers `/my-leads`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const salesHumanId = request.nextUrl.searchParams.get("salesHumanId");
  if (salesHumanId === null || salesHumanId.length === 0) {
    return NextResponse.json({ error: { message: "salesHumanId is required" } }, { status: 400 });
  }

  try {
    const leads = await callAaosApi<readonly LeadDto[]>("/api/v1/leads/my", {
      searchParams: { salesHumanId },
    });
    return NextResponse.json({ leads });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
