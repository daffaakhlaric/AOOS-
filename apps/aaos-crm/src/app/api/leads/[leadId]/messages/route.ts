import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MessageDto } from "@/types/crm.types";

export interface MessagesPageDto {
  readonly messages: readonly MessageDto[];
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}

/**
 * `GET /api/leads/:leadId/messages?page=&limit=&order=` — proxies `aaos-api`'s real, already-built
 * `GET /api/v1/leads/:id/messages` (AAOS-CHAT-ROOM-CLARA, reused per coordinator note #2 rather than
 * a new `/conversations` namespace). `/inbox` uses `limit=1&order=desc` to read each visible lead's
 * latest message for the "Belum dibaca" tab's real `readAt`-based unread signal — see
 * `InboxClient.tsx`'s docstring.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const page = request.nextUrl.searchParams.get("page") ?? undefined;
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
  const order = request.nextUrl.searchParams.get("order") ?? undefined;
  try {
    const data = await callAaosApi<MessagesPageDto>(`/api/v1/leads/${params.leadId}/messages`, {
      searchParams: { page, limit, order },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
