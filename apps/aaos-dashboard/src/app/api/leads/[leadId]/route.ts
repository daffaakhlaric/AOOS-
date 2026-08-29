import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDetailDto } from "@/types/dashboard.types";

/** `GET /api/leads/:leadId` — proxies `aaos-api`'s `GET /api/v1/leads/:id`. Powers `/leads/[leadId]`, the manager chat room (AAOS-CHAT-ROOM-CLARA). */
export async function GET(
  _request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  try {
    const lead = await callAaosApi<LeadDetailDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}`,
    );
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
