import { NextResponse, type NextRequest } from "next/server";

import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { AbTestDto, CreateAbTestInput } from "@/types/dashboard.types";

// See `app/api/settings/route.ts`'s comment on this same export — these handlers also read the
// caller's real session cookies (via `resolveRouteSession`) on every request.
export const dynamic = "force-dynamic";

/**
 * `GET/POST /api/abtesting` — proxies `aaos-api`'s real `GET/POST /api/v1/abtesting`.
 *
 * TENANT-SCOPING FIX (Phase T2, docs/PROMPT-AAOS-META-ADS-TENANT-SCOPING.md): forwards
 * `x-tenant-id: session.tenantId` (same `resolveRouteSession`/`callAaosApi` pattern
 * `api/listings/route.ts` already establishes) — this proxy previously called `aaos-api` with no
 * tenant header at all, now that `AbTestingController` reads one.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  try {
    const tests = await callAaosApi<readonly AbTestDto[]>("/api/v1/abtesting", {
      searchParams: { status: status ?? undefined },
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ tests });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await resolveRouteSession(request);
  if (session === null) {
    return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as CreateAbTestInput;
  try {
    const test = await callAaosApi<AbTestDto>("/api/v1/abtesting", {
      method: "POST",
      body,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ test }, { status: 201 });
  } catch (error) {
    if (error instanceof AaosApiError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.statusCode });
    }
    return NextResponse.json({ error: { message: "Unexpected error" } }, { status: 500 });
  }
}
