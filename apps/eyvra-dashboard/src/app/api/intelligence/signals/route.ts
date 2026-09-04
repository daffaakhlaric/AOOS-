import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { IntelligenceSignalsDto } from "@/types/dashboard.types";

/** `GET /api/intelligence/signals` — proxies `aaos-api`'s real `GET /api/v1/intelligence/signals` (latest persisted run for this tenant, 404 when none has ever completed). */
export async function GET(): Promise<NextResponse> {
  try {
    const signals = await callAaosApi<IntelligenceSignalsDto>("/api/v1/intelligence/signals");
    return NextResponse.json({ signals });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
