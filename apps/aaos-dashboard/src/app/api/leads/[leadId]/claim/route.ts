import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LeadDto } from "@/types/dashboard.types";

interface ClaimLeadBody {
  readonly salesHumanId: string;
}

/**
 * `POST /api/leads/:leadId/claim` — proxies `aaos-api`'s real `POST /api/v1/leads/:id/claim`
 * (`ClaimLeadBodyDto`'s real shape is just `{ salesHumanId }` — `branchId`/`assignmentMode` are
 * derived server-side, never client input). Powers `/jessy/contacts`'s "Assigned to" dropdown
 * (MENU RESTRUCTURE FINAL coordinator note #4) — there is no `/leads/:id/assign` endpoint; this
 * reuses the real, already-existing claim flow instead of inventing a parallel one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json()) as ClaimLeadBody;
  try {
    const lead = await callAaosApi<LeadDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/claim`,
      { method: "POST", body },
    );
    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
