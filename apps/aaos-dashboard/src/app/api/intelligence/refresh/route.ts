import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { IntelligenceSignalsDto } from "@/types/dashboard.types";

/** `POST /api/intelligence/refresh` — proxies `aaos-api`'s real `POST /api/v1/intelligence/refresh` (runs the full aggregation + LLM synthesis synchronously). */
export async function POST(): Promise<NextResponse> {
  try {
    const signals = await callAaosApi<IntelligenceSignalsDto>("/api/v1/intelligence/refresh", {
      method: "POST",
    });
    return NextResponse.json({ signals });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
