import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { StressTestRunDto } from "@/lib/stress-test";

export const dynamic = "force-dynamic";

/** `GET /api/creative-stress-test/[id]` — one real, tenant-scoped run for the detail page. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const run = await callAaosApi<StressTestRunDto>(
      `/api/v1/creative-stress-test/${encodeURIComponent(params.id)}`,
      { headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(run, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Run belum dapat dimuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
