import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreateConnectLinkResponseDto } from "@/types/sosmed.types";

/** `POST /api/sosmed/oauth/sales/connect-links` — proxies `aaos-api`'s real `POST /api/v1/sosmed/oauth/sales/connect-links` ("+ Hubungkan Akun Sales" flow, Step 2 "Generate link"). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { salesHumanId?: string };
  try {
    const result = await callAaosApi<CreateConnectLinkResponseDto>(
      "/api/v1/sosmed/oauth/sales/connect-links",
      { method: "POST", body },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
