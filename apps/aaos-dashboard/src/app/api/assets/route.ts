import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AssetListDto } from "@/types/dashboard.types";

/**
 * `GET /api/assets` — proxies `GET /api/v1/assets`, forwarding only the filters the caller set.
 * `aaos-api` re-validates each against the REAL `AssetType`/`AssetStatus`/`Branch` enums
 * (`GetAssetsQuerySchema`), so a fabricated value is rejected upstream with a 422 rather than
 * quietly dropped here. "Semua" is expressed by omitting `type`, never by an invented `ALL` value.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {
    type: url.searchParams.get("type") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    branch: url.searchParams.get("branch") ?? undefined,
    unitId: url.searchParams.get("unitId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
  };

  try {
    const data = await callAaosApi<AssetListDto>("/api/v1/assets", { searchParams });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
