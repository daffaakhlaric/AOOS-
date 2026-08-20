import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SimulationStatusDto } from "@/types/dashboard.types";

/** `POST /api/simulation/:id/rollback` — proxies `POST /api/v1/simulation/:id/rollback` (AAOS-GO-LIVE, Phase 4). The real rollback-window check is server-side in `GoLiveService.rollback`. */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<SimulationStatusDto>(
      `/api/v1/simulation/${encodeURIComponent(params.id)}/rollback`,
      { method: "POST", body: body ?? {} },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
