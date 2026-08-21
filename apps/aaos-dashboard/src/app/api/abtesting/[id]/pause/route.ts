import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { AbTestDto } from "@/types/dashboard.types";

/** `POST /api/abtesting/:id/pause` — proxies `aaos-api`'s real `POST /api/v1/abtesting/:id/pause` ("Pause Test" button). */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const test = await callAaosApi<AbTestDto>(
      `/api/v1/abtesting/${encodeURIComponent(params.id)}/pause`,
      { method: "POST" },
    );
    return NextResponse.json({ test });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
