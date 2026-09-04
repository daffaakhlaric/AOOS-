import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { JudgeHistoryPointDto } from "@/types/learning.types";

export const dynamic = "force-dynamic";

/**
 * `GET /api/learning/judge-history?agent=SAMANTHA&days=30` — proxies
 * `GET /api/v1/learning/judge-history` (AAOS Self-Improving, Phase SI-6 — the Learning Monitor's
 * real Score Trend chart data source, real `judge_results` history for the caller's own real
 * session tenant).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const url = new URL(request.url);
  const agent = url.searchParams.get("agent") ?? "SAMANTHA";
  const days = url.searchParams.get("days") ?? undefined;
  try {
    const data = await callAaosApi<readonly JudgeHistoryPointDto[]>(
      "/api/v1/learning/judge-history",
      {
        headers: { "x-tenant-id": session.tenantId },
        searchParams: { agent, days },
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
