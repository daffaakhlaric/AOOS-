import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CalendarEventDto } from "@/types/dashboard.types";

/** `GET /api/calendar?range=this_week|&month=YYYY-MM` — proxies `GET /api/v1/calendar`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") ?? undefined;
  const month = searchParams.get("month") ?? undefined;
  try {
    const data = await callAaosApi<readonly CalendarEventDto[]>("/api/v1/calendar", {
      searchParams: { range, month },
    });
    return NextResponse.json({ events: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/** `POST /api/calendar` — proxies `POST /api/v1/calendar` ("Tambah Jadwal" modal's payload). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<CalendarEventDto>("/api/v1/calendar", {
      method: "POST",
      body,
    });
    return NextResponse.json({ event: data }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
