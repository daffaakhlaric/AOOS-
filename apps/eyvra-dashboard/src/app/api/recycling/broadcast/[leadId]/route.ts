import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { BroadcastResultDto } from "@/types/dashboard.types";

interface BroadcastToLeadBody {
  readonly templateId: string;
}

/** `POST /api/recycling/broadcast/:leadId` — proxies `aaos-api`'s real `POST /api/v1/recycling/broadcast/:leadId` (TAB 1's "Kirim Sekarang"). */
export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as BroadcastToLeadBody;
  try {
    const result = await callAaosApi<BroadcastResultDto>(
      `/api/v1/recycling/broadcast/${encodeURIComponent(params.leadId)}`,
      { method: "POST", body },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
