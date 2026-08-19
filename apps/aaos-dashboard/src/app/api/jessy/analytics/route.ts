import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadsAnalyticsDto } from "@/types/dashboard.types";

/**
 * `GET /api/jessy/analytics?days=` — proxies `aaos-api`'s real, new `GET /api/v1/leads/analytics`
 * (MENU RESTRUCTURE FINAL `/jessy/analytics`). Same thin-proxy discipline as every other route in
 * this file — no client-side aggregation, `aaos-api` computes every KPI.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const days = request.nextUrl.searchParams.get("days") ?? undefined;
  try {
    const analytics = await callAaosApi<LeadsAnalyticsDto>("/api/v1/leads/analytics", {
      searchParams: { days },
    });
    return NextResponse.json(analytics);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
