import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScrapedUnitDto } from "@/types/dashboard.types";

/** `GET /api/scraper/stock/:unitId` — proxies `GET /api/v1/scraper/stock/:unitId` (unit-detail modal). */
export async function GET(
  _request: Request,
  { params }: { params: { unitId: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<ScrapedUnitDto>(
      `/api/v1/scraper/stock/${encodeURIComponent(params.unitId)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
