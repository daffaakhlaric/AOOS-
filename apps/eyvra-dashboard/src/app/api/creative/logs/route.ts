import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativeLogDto } from "@/types/dashboard.types";

/**
 * `GET /api/creative/logs` — proxies `GET /api/v1/creative-packages/logs`, the real append-only
 * `creative_logs` audit trail behind the "Log Samantha × Kai" tab. Every row it returns corresponds
 * to something the real pipeline actually did; nothing is synthesised here or upstream.
 *
 * Declared under `logs/` so Next matches it before the `[id]` dynamic segment, mirroring the
 * route-ordering constraint `aaos-api`'s own controller has.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const searchParams: Record<string, string | undefined> = {
    packageId: url.searchParams.get("packageId") ?? undefined,
    eventType: url.searchParams.get("eventType") ?? undefined,
    sinceHours: url.searchParams.get("sinceHours") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };
  try {
    const data = await callAaosApi<readonly CreativeLogDto[]>("/api/v1/creative-packages/logs", {
      searchParams,
    });
    return NextResponse.json({ logs: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
