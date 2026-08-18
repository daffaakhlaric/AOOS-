import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { StockListDto } from "@/types/dashboard.types";

/**
 * `GET /api/scraper/stock` — proxies `GET /api/v1/scraper/stock`, forwarding only the filters the
 * caller actually set. `aaos-api` re-validates every one of them with Zod (`GetStockQuerySchema`),
 * so an unknown branch or an out-of-range limit is rejected there with a 422 rather than silently
 * ignored here.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {
    branch: url.searchParams.get("branch") ?? undefined,
    available: url.searchParams.get("available") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };

  try {
    const data = await callAaosApi<StockListDto>("/api/v1/scraper/stock", { searchParams });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
