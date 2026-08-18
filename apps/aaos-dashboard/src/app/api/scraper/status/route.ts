import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScraperStatusDto } from "@/types/dashboard.types";

/** `GET /api/scraper/status` — proxies `GET /api/v1/scraper/status` (KPI strip + last real job). */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<ScraperStatusDto>("/api/v1/scraper/status");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
