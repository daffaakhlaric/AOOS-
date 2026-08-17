import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SimulationStatusDto } from "@/types/dashboard.types";

/** `GET /api/simulation/:id/status` — proxies `GET /api/v1/simulation/:id/status`, polled by the wizard while a run is `RUNNING`. */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<SimulationStatusDto>(
      `/api/v1/simulation/${encodeURIComponent(params.id)}/status`,
    );
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
