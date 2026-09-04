import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { RecyclingPoolLeadDto } from "@/types/dashboard.types";

/** `GET /api/recycling/pool` — proxies `aaos-api`'s real `GET /api/v1/recycling/pool` (TAB 1). */
export async function GET(): Promise<NextResponse> {
  try {
    const leads = await callAaosApi<readonly RecyclingPoolLeadDto[]>("/api/v1/recycling/pool");
    return NextResponse.json({ leads });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
