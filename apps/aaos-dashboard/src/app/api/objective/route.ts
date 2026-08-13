import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import type { ObjectiveDto } from "@/types/dashboard.types";

/** `GET /api/objective` — proxies `GET /api/v1/objective`. A 404 from `aaos-api` (no objective set yet for the tenant) is passed through as `{ objective: null }` with a 200, not an error — "no objective yet" is a normal, expected dashboard state, not a failure. */
export async function GET(): Promise<NextResponse> {
  try {
    const data = await callAaosApi<ObjectiveDto>("/api/v1/objective");
    return NextResponse.json({ objective: data });
  } catch (error) {
    if (error instanceof AaosApiError && error.statusCode === 404) {
      return NextResponse.json({ objective: null });
    }
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

/** `POST /api/objective` — proxies `POST /api/v1/objective`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => undefined);
  try {
    const data = await callAaosApi<ObjectiveDto>("/api/v1/objective", { method: "POST", body });
    return NextResponse.json({ objective: data }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
