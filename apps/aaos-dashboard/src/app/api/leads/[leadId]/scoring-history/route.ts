import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ScoringEventDto } from "@/types/dashboard.types";

/** `GET /api/leads/:leadId/scoring-history` — proxies `aaos-api`'s `GET /api/v1/leads/:id/scoring-history`. Powers the chat room's "Scoring History" card. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  try {
    const history = await callAaosApi<readonly ScoringEventDto[]>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/scoring-history`,
    );
    return NextResponse.json(history);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
