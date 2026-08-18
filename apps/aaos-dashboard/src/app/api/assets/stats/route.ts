import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AssetStatsDto } from "@/types/dashboard.types";

/** `GET /api/assets/stats` — proxies `GET /api/v1/assets/stats` (Asset Library KPI strip). */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<AssetStatsDto>("/api/v1/assets/stats");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
