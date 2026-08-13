import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/crm.types";

interface UpdateStatusBody {
  readonly status: string;
}

/** `PUT /api/leads/:leadId/status` — proxies `aaos-api`'s `PUT /api/v1/leads/:id/status` (spec "Also Update apps/aaos-api"). Used by `/my-leads`'s "Follow Up" action. */
export async function PUT(
  request: Request,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json()) as UpdateStatusBody;
  try {
    const lead = await callAaosApi<LeadDto>(`/api/v1/leads/${params.leadId}/status`, {
      method: "PUT",
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
