import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";

/** `POST /api/verdicts` — proxies `POST /api/v1/verdicts` (a real `aaos-api` endpoint that pre-dates AAOS-W4A; not one of this task's 7 new endpoints, but the dashboard's "⚡ Execute" button needs somewhere real to call). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<{ readonly action: string }>("/api/v1/verdicts", {
      method: "POST",
      body,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
