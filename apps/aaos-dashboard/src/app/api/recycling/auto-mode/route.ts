import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AutoModeDto } from "@/types/dashboard.types";

/** `GET/POST /api/recycling/auto-mode` — proxies `aaos-api`'s real `GET/POST /api/v1/recycling/auto-mode` (the page header's toggle). */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<AutoModeDto>("/api/v1/recycling/auto-mode");
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as AutoModeDto;
  try {
    const data = await callAaosApi<AutoModeDto>("/api/v1/recycling/auto-mode", {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
