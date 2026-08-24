import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SosmedAccountDto } from "@/types/sosmed.types";

/** `GET /api/sosmed/accounts` — proxies `aaos-api`'s real `GET /api/v1/sosmed/accounts` (masked tokens). */
export async function GET(): Promise<NextResponse> {
  try {
    const accounts = await callAaosApi<readonly SosmedAccountDto[]>("/api/v1/sosmed/accounts");
    return NextResponse.json({ accounts });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
