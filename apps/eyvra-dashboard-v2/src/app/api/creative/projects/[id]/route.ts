import { NextResponse, type NextRequest } from "next/server";
import { resolveRouteSession } from "@/lib/route-session";
import { AaosApiError, callAaosApi } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!/^[a-f0-9-]{36}$/.test(params.id))
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 });
  try {
    const data = await callAaosApi("/api/v1/creative-packages/handoff/projects/" + params.id, {
      headers: { "x-tenant-id": session.tenantId },
      timeoutMs: 20000,
    });
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Proyek Kai gagal dimuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
