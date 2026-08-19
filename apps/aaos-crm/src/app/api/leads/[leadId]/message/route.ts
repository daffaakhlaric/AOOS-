import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MessageDto } from "@/types/crm.types";

interface SendMessageBody {
  readonly salesHumanId: string;
  readonly salesName: string;
  readonly message: string;
}

/**
 * `POST /api/leads/:leadId/message` — proxies `aaos-api`'s `POST /api/v1/leads/:id/message` (a
 * sales human's real reply, sent via the real WhatsApp connector, persisted with `sender_type =
 * 'SALES_HUMAN'`). Replaces/supplements the previous `wa.me/...` deep-link-only reply affordance —
 * see `LeadDetail.tsx`'s docstring.
 */
export async function POST(
  request: Request,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const body = (await request.json()) as SendMessageBody;
  try {
    const message = await callAaosApi<MessageDto>(`/api/v1/leads/${params.leadId}/message`, {
      method: "POST",
      body,
    });
    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
