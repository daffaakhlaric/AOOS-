import { NextResponse, type NextRequest } from "next/server";
import { callAaosApi, AaosApiError } from "@/lib/api";
import { resolveRouteSession } from "@/lib/route-session";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await resolveRouteSession(request);
  if (!session) return NextResponse.json({ error: { message: "Unauthorized" } }, { status: 401 });
  try {
    const data = await callAaosApi("/api/v1/calendar", {
      headers: { "x-tenant-id": session.tenantId },
      searchParams: { range: "this_week" },
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: { message: "Jadwal review belum dapat dimuat." } },
      { status: e instanceof AaosApiError ? e.statusCode : 500 },
    );
  }
}
