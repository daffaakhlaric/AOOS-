import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AbTestDto } from "@/types/dashboard.types";

/** `GET /api/abtesting/:id` — proxies `aaos-api`'s real `GET /api/v1/abtesting/:id`. */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const test = await callAaosApi<AbTestDto>(`/api/v1/abtesting/${encodeURIComponent(params.id)}`);
    return NextResponse.json({ test });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
