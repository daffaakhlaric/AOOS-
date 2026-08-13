import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDetailDto } from "@/types/crm.types";

/** `GET /api/leads/:leadId` — proxies `aaos-api`'s `GET /api/v1/leads/:id`. Powers `/leads/[leadId]` (coordinator note #2's honest lead-detail page). */
export async function GET(
  _request: Request,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  try {
    const lead = await callAaosApi<LeadDetailDto>(`/api/v1/leads/${params.leadId}`);
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
