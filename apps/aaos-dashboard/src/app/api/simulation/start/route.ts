import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";

interface StartSimulationResponse {
  readonly id: string;
  readonly status: "RUNNING";
}

/** `POST /api/simulation/start` — proxies `POST /api/v1/simulation/start`. Returns immediately with a `simulationId` — the real pipeline runs detached on `aaos-api`; the wizard polls `/api/simulation/:id/status` for progress (coordinator note #8, never a synchronous multi-minute request). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<StartSimulationResponse>("/api/v1/simulation/start", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status: 202 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
