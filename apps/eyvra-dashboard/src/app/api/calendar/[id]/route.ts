import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CalendarEventDto } from "@/types/dashboard.types";

/** `PUT /api/calendar/:id` — proxies `PUT /api/v1/calendar/:id`. */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<CalendarEventDto>(
      `/api/v1/calendar/${encodeURIComponent(params.id)}`,
      { method: "PUT", body },
    );
    return NextResponse.json({ event: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/** `DELETE /api/calendar/:id` — proxies `DELETE /api/v1/calendar/:id`. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    await callAaosApi<undefined>(`/api/v1/calendar/${encodeURIComponent(params.id)}`, {
      method: "DELETE",
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
