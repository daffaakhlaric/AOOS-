import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScrapeJobDto } from "@/types/dashboard.types";

/**
 * `GET /api/scraper/jobs/:jobId` — proxies `GET /api/v1/scraper/jobs/:jobId`. The progress modal's
 * fallback when the SSE stream isn't available (or gets cut), and the source of the final result
 * once a run finishes.
 */
export async function GET(
  _request: Request,
  { params }: { params: { jobId: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<ScrapeJobDto>(
      `/api/v1/scraper/jobs/${encodeURIComponent(params.jobId)}`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
