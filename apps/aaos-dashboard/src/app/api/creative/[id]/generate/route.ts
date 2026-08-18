import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { CreativePackageDto } from "@/types/dashboard.types";

/**
 * `POST /api/creative/:id/generate` — proxies `POST /api/v1/creative-packages/:id/generate`.
 *
 * THIS IS THE ONLY ROUTE IN THIS APP THAT SPENDS REAL KIE AI CREDITS, and it is reachable only
 * from an explicit per-brief click ("Kirim ke Kai"). There is no timer, no cron, and no auto-mode
 * anywhere in this app that can call it.
 *
 * Returns immediately with the `GENERATING` row (`aaos-api` answers 202 and runs the real Kai
 * pipeline detached); the dashboard's "Sedang Diproses" tab polls the persisted state from there.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  try {
    const data = await callAaosApi<CreativePackageDto>(
      `/api/v1/creative-packages/${encodeURIComponent(params.id)}/generate`,
      { method: "POST", body: {} },
    );
    return NextResponse.json({ package: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
