import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SimulationStatusDto } from "@/types/dashboard.types";

/** `POST /api/simulation/:id/pause` — proxies `POST /api/v1/simulation/:id/pause` (AAOS-GO-LIVE, Phase 4) — the `/go-live` monitoring panel's `[⏸ Pause]` button. */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<SimulationStatusDto>(
      `/api/v1/simulation/${encodeURIComponent(params.id)}/pause`,
      { method: "POST", body: {} },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
