import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { OAuthStartResponseDto } from "@/types/sosmed.types";

/** `GET /api/sosmed/oauth/official/start` — proxies `aaos-api`'s real `GET /api/v1/sosmed/oauth/official/start` ("+ Hubungkan Akun Official" button). Manager-authenticated (this app's own middleware session gate), same as every other route under `(app)`. */
export async function GET(): Promise<NextResponse> {
  try {
    const result = await callAaosApi<OAuthStartResponseDto>("/api/v1/sosmed/oauth/official/start");
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
