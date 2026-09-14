import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PhotoAnalysisDto } from "@/types/dashboard.types";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative/photo-analysis` — proxies `POST /api/v1/llm/photo-analysis` (Kai Creative
 * Engine Sprint 1/2). Real, per-photo, on-demand from `PropertyManualBriefForm.tsx`'s photo strip
 * (Sprint 4) — never auto-called, matches the real per-call Vision cost this endpoint carries.
 *
 * Same tenant-scoped proxy shape `app/api/creative/property/route.ts` already establishes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => ({}));
  try {
    const data = await callAaosApi<PhotoAnalysisDto>("/api/v1/llm/photo-analysis", {
      method: "POST",
      body: body ?? {},
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
