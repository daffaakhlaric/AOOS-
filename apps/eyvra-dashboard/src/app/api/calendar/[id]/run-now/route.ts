import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CalendarEventDto } from "@/types/dashboard.types";

/** `POST /api/calendar/:id/run-now` — proxies `POST /api/v1/calendar/:id/run-now` ("▶ Jalankan"). */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<CalendarEventDto>(
      `/api/v1/calendar/${encodeURIComponent(params.id)}/run-now`,
      { method: "POST" },
    );
    return NextResponse.json({ event: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
