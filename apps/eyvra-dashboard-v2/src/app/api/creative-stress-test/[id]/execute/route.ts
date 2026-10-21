import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { StressTestRunDto } from "@/lib/stress-test";

export const dynamic = "force-dynamic";

/**
 * `POST /api/creative-stress-test/[id]/execute` — transitions a real run to the honest
 * `WAITING_FOR_ENGINE` terminal state. Never returns a fabricated score/result.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const run = await callAaosApi<StressTestRunDto>(
      `/api/v1/creative-stress-test/${encodeURIComponent(params.id)}/execute`,
      { method: "POST", headers: { "x-tenant-id": session.tenantId } },
    );
    return NextResponse.json(run, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Run belum dapat dijalankan." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
