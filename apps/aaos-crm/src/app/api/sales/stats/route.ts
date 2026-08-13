import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SalesStatsDto } from "@/types/crm.types";

/** `GET /api/sales/stats?salesHumanId=...` — proxies `aaos-api`'s `GET /api/v1/sales/stats`. Powers `/stats`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const salesHumanId = request.nextUrl.searchParams.get("salesHumanId");
  if (salesHumanId === null || salesHumanId.length === 0) {
    return NextResponse.json({ error: { message: "salesHumanId is required" } }, { status: 400 });
  }

  try {
    const stats = await callAaosApi<SalesStatsDto>("/api/v1/sales/stats", {
      searchParams: { salesHumanId },
    });
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
