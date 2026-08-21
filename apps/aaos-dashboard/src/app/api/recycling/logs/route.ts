import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { BroadcastLogDto } from "@/types/dashboard.types";

/** `GET /api/recycling/logs?limit=` — proxies `aaos-api`'s real `GET /api/v1/recycling/logs` (TAB 3). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
  try {
    const logs = await callAaosApi<readonly BroadcastLogDto[]>("/api/v1/recycling/logs", {
      searchParams: { limit },
    });
    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
