import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  try {
    return NextResponse.json(
      await callAaosApi(`/api/v1/creative-packages/${encodeURIComponent(params.id)}`, {
        headers: { "x-tenant-id": session.tenantId },
        timeoutMs: 20000,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: { message: "Detail creative belum dapat dimuat." } },
      { status: error instanceof AaosApiError ? error.statusCode : 500 },
    );
  }
}
