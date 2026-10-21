import { NextResponse, type NextRequest } from "next/server";
import { AaosApiError, callAaosApi } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(
      await callAaosApi(`/api/v1/listings/${encodeURIComponent(params.id)}/workspace`, {
        headers: { "x-tenant-id": session.tenantId },
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof AaosApiError ? error.message : "Listing gagal dimuat." },
      { status: error instanceof AaosApiError ? error.statusCode : 503 },
    );
  }
}
