import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MessagesPageDto } from "@/types/dashboard.types";

/**
 * `GET /api/leads/:leadId/messages?page=&limit=&order=` — proxies `aaos-api`'s real, paginated
 * `GET /api/v1/leads/:id/messages` (MENU RESTRUCTURE FINAL `/jessy/inbox`, coordinator note #2).
 * Query params are forwarded verbatim — `aaos-api`'s `GetMessagesQuerySchema` already coerces/
 * bounds/defaults them.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } },
): Promise<NextResponse> {
  const page = request.nextUrl.searchParams.get("page") ?? undefined;
  const limit = request.nextUrl.searchParams.get("limit") ?? undefined;
  const order = request.nextUrl.searchParams.get("order") ?? undefined;

  try {
    const messagesPage = await callAaosApi<MessagesPageDto>(
      `/api/v1/leads/${encodeURIComponent(params.leadId)}/messages`,
      { searchParams: { page, limit, order } },
    );
    return NextResponse.json(messagesPage);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
