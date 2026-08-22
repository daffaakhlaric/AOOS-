import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { MetaAudienceDto } from "@/types/dashboard.types";

/** `GET /api/lookalike/audiences` — proxies `aaos-api`'s real `GET /api/v1/lookalike/audiences`. */
export async function GET(): Promise<NextResponse> {
  try {
    const audiences = await callAaosApi<readonly MetaAudienceDto[]>("/api/v1/lookalike/audiences");
    return NextResponse.json({ audiences });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
