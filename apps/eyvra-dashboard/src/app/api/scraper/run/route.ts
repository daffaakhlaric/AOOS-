import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { RunScrapeResponseDto } from "@/types/dashboard.types";

/**
 * `POST /api/scraper/run` — proxies `POST /api/v1/scraper/run`. Returns 202 immediately with a
 * `jobId`; the real scrape runs detached on `aaos-api`, and the client follows progress via
 * `/api/scraper/jobs/:jobId/stream` (SSE, proxied) with `/api/scraper/jobs/:jobId` as the fallback.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<RunScrapeResponseDto>("/api/v1/scraper/run", {
      method: "POST",
      body: body ?? {},
    });
    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
