import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/crm.types";

interface ClaimBody {
  readonly salesHumanId: string;
}

/** `POST /api/leads/:leadId/claim` — proxies `aaos-api`'s `POST /api/v1/leads/:id/claim`. Returns the upstream 409 verbatim when the lead is already claimed (spec's "already claimed → 409 conflict"). */
export async function POST(
  request: Request,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json()) as ClaimBody;
  try {
    const lead = await callAaosApi<LeadDto>(`/api/v1/leads/${params.leadId}/claim`, {
      method: "POST",
      body,
    });
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
