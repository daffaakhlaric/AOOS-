import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const projects = await callAaosApi("/api/v1/creative-packages/handoff/projects", {
      headers: { "x-tenant-id": session.tenantId },
      timeoutMs: 20000,
    });
    return NextResponse.json({ projects }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Proyek gagal dimuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
