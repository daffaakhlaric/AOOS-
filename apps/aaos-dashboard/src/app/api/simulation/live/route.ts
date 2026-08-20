import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SimulationStatusDto } from "@/types/dashboard.types";

/** `GET /api/simulation/live` — proxies `GET /api/v1/simulation/live` (AAOS-GO-LIVE, Phase 4), the `/go-live` Monitor page's real data source. */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly SimulationStatusDto[]>("/api/v1/simulation/live");
    return NextResponse.json({ live: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
