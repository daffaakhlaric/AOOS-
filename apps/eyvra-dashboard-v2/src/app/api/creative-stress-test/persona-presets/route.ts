import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { PersonaPresetDto } from "@/lib/stress-test";

export const dynamic = "force-dynamic";

/** `GET /api/creative-stress-test/persona-presets` — the 5 real, static, versioned presets. */
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await callAaosApi<{ version: number; presets: readonly PersonaPresetDto[] }>(
      "/api/v1/creative-stress-test/persona-presets",
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof AaosApiError ? error.message : "Persona preset belum dapat dimuat.",
      },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
