import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { GenerateHashtagsInput, GenerateHashtagsResponseDto } from "@/types/sosmed.types";

/** `POST /api/sosmed/generate-hashtags` — proxies `aaos-api`'s real `POST /api/v1/sosmed/generate-hashtags` (Tamara). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as GenerateHashtagsInput;
  try {
    const result = await callAaosApi<GenerateHashtagsResponseDto>(
      "/api/v1/sosmed/generate-hashtags",
      { method: "POST", body },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
