import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MarketSignalsDto } from "@/types/market-signals.types";

/**
 * `GET /api/market-signals/latest` — proxies `aaos-api`'s real `GET /api/v1/market-signals/latest`
 * (latest persisted "Sinyal Pasar" run for this tenant, 404 when none has ever completed — AAOS
 * LOOP UPGRADE, Sprint 7 Prompt 18). Same "no `x-tenant-id` needed" shape as
 * `api/intelligence/signals/route.ts` — the real `aaos-api` endpoint reads its own single,
 * process-wide `AAOS_TENANT_ID`, not a per-request tenant (see `MarketIntelligenceController`'s own
 * doc).
 */
export async function GET(): Promise<NextResponse> {
  try {
    const signals = await callAaosApi<MarketSignalsDto>("/api/v1/market-signals/latest");
    return NextResponse.json({ signals });
  } catch (error) {
    if (error instanceof AaosApiError && error.statusCode === 404) {
      return NextResponse.json({ signals: null });
    }
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
