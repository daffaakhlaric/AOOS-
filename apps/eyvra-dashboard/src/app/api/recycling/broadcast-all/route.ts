import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { BroadcastAllResultDto } from "@/types/dashboard.types";

/** `POST /api/recycling/broadcast-all` — proxies `aaos-api`'s real `POST /api/v1/recycling/broadcast-all` (TAB 1's "Broadcast ke Semua yang Siap"). */
export async function POST(): Promise<NextResponse> {
  try {
    const result = await callAaosApi<BroadcastAllResultDto>("/api/v1/recycling/broadcast-all", {
      method: "POST",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
