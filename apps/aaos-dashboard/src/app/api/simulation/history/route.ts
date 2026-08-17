import { NextResponse } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { SimulationHistoryEntryDto } from "@/types/dashboard.types";

/** `GET /api/simulation/history` — proxies `GET /api/v1/simulation/history`, backs the wizard's "Riwayat" tab. */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<readonly SimulationHistoryEntryDto[]>(
      "/api/v1/simulation/history",
    );
    return NextResponse.json({ history: data });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
