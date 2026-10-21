import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { ObjectionSourceDto } from "@/lib/stress-test";

export const dynamic = "force-dynamic";

/** `GET /api/creative-stress-test/objection-sources` — the real/honest-gap source map. */
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const sources = await callAaosApi<readonly ObjectionSourceDto[]>(
      "/api/v1/creative-stress-test/objection-sources",
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json({ sources }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof AaosApiError ? error.message : "Sumber objection belum dapat dimuat.",
      },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
