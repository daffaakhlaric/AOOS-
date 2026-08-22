import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MetaAudienceDto } from "@/types/dashboard.types";

/** `POST /api/lookalike/audiences/lookalike` — proxies `aaos-api`'s real `POST /api/v1/lookalike/audiences/lookalike` ("+ Buat Lookalike N%" buttons). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { percentage?: 1 | 2 | 3 };
  try {
    const audience = await callAaosApi<MetaAudienceDto>("/api/v1/lookalike/audiences/lookalike", {
      method: "POST",
      body,
    });
    return NextResponse.json({ audience }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
