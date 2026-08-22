import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { LookalikeSyncResultDto } from "@/types/dashboard.types";

/** `POST /api/lookalike/sync` — proxies `aaos-api`'s real `POST /api/v1/lookalike/sync` ("Sync Hot Leads ke Meta" button). */
export async function POST(): Promise<NextResponse> {
  try {
    const result = await callAaosApi<LookalikeSyncResultDto>("/api/v1/lookalike/sync", {
      method: "POST",
    });
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
