import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
import type { StressTestRunDto } from "@/lib/stress-test";

export const dynamic = "force-dynamic";

/** `GET /api/creative-stress-test` — real, tenant-scoped run history (Previous Simulation Runs). */
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const runs = await callAaosApi<readonly StressTestRunDto[]>("/api/v1/creative-stress-test", {
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json({ runs }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof AaosApiError ? error.message : "Riwayat run belum dapat dimuat.",
      },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}

/** `POST /api/creative-stress-test` — creates a real, persisted run (no evaluator content yet). */
export async function POST(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  try {
    const run = await callAaosApi<StressTestRunDto>("/api/v1/creative-stress-test", {
      method: "POST",
      body,
      headers: { "x-tenant-id": session.tenantId },
    });
    return NextResponse.json(run, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Run belum dapat dibuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
