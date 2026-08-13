import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativePackageDto } from "@/types/dashboard.types";

/** `GET /api/creative` — proxies `GET /api/v1/creative-packages` (spec "creative/route.ts"). */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly CreativePackageDto[]>("/api/v1/creative-packages");
    return NextResponse.json({ packages: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
