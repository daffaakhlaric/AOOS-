import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LookalikeStatusDto } from "@/types/dashboard.types";

/** `GET /api/lookalike/status` — proxies `aaos-api`'s real `GET /api/v1/lookalike/status`. */
export async function GET(): Promise<NextResponse> {
  try {
    const status = await callAaosApi<LookalikeStatusDto>("/api/v1/lookalike/status");
    return NextResponse.json({ status });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
